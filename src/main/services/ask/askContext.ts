import type { CitationFormat, RankedPassage } from '@shared/types/database'
import { segmentIntoChunks, tokenizeForSearch } from '../thesis/textSegmentation'

const LOCAL_PASSAGE_LIMIT = 8
const LOCAL_AFTER_WINDOW = 5
const LOCAL_BEFORE_WINDOW = 1

interface CurrentPagePassageInput {
  documentId: string
  documentTitle: string
  pageNumber: number
  text: string
  citations: Record<CitationFormat, string>
}

function termVariants(token: string): string[] {
  const variants = new Set([token])
  for (const suffix of ['ing', 'ed', 'es', 's']) {
    if (token.length > suffix.length + 3 && token.endsWith(suffix)) {
      variants.add(token.slice(0, -suffix.length))
    }
  }
  return [...variants]
}

function searchTerms(text: string): Set<string> {
  const terms = new Set<string>()
  for (const token of tokenizeForSearch(text)) {
    for (const variant of termVariants(token)) terms.add(variant)
  }
  return terms
}

function localScore(queryTerms: Set<string>, text: string): number {
  if (queryTerms.size === 0) return 0
  const terms = searchTerms(text)
  let score = 0
  for (const queryTerm of queryTerms) {
    if (terms.has(queryTerm)) {
      score += 2
      continue
    }
    for (const term of terms) {
      if (term.startsWith(queryTerm) || queryTerm.startsWith(term)) {
        score += 1
        break
      }
    }
  }
  return score
}

export function buildCurrentPagePassages(
  question: string,
  input: CurrentPagePassageInput
): RankedPassage[] {
  const chunks = segmentIntoChunks(input.text)
  if (chunks.length === 0) return []

  const queryTerms = searchTerms(question)
  const scored = chunks
    .map((chunk) => ({ index: chunk.index, score: localScore(queryTerms, chunk.text) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)

  const selected = new Set<number>()
  if (scored.length === 0) {
    for (let i = 0; i < Math.min(LOCAL_PASSAGE_LIMIT, chunks.length); i += 1) selected.add(i)
  } else {
    for (const hit of scored) {
      const start = Math.max(0, hit.index - LOCAL_BEFORE_WINDOW)
      const end = Math.min(chunks.length - 1, hit.index + LOCAL_AFTER_WINDOW)
      for (let i = start; i <= end; i += 1) selected.add(i)
      if (selected.size >= LOCAL_PASSAGE_LIMIT) break
    }
  }

  return [...selected]
    .sort((a, b) => a - b)
    .slice(0, LOCAL_PASSAGE_LIMIT)
    .map((index, i) => ({
      id: `${input.documentId}:${input.pageNumber}:current-${chunks[index].index}`,
      documentId: input.documentId,
      documentTitle: input.documentTitle,
      pageNumber: input.pageNumber,
      snippet: chunks[index].text,
      score: 1 - i * 0.03,
      citations: input.citations
    }))
}

function passageKey(passage: RankedPassage): string {
  return `${passage.documentId}:${passage.pageNumber}:${passage.snippet.replace(/\s+/g, ' ').trim()}`
}

export function mergeLocalFirstPassages(
  localPassages: RankedPassage[],
  retrievedPassages: RankedPassage[],
  limit: number
): RankedPassage[] {
  const seen = new Set<string>()
  const out: RankedPassage[] = []
  for (const passage of [...localPassages, ...retrievedPassages]) {
    const key = passageKey(passage)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(passage)
    if (out.length >= limit) break
  }
  return out
}
