// Pure glossary helpers (no electron/openai/db imports — unit-tested). Heuristic
// definition extraction for the no-key path: catches the common "X is/are
// defined as …", "X refers to …", "X means …", "X, a …" patterns. citationsFor
// is injected so the module stays pure.

import type { CitationFormat, GlossaryResult, GlossaryTerm } from '@shared/types/database'

// Each pattern captures (1) the term and (2) the defining clause.
const DEFINITION_PATTERNS: RegExp[] = [
  /\b([A-Z][A-Za-z][\w-]*(?:\s+[a-z][\w-]+){0,2})\s+(?:is|are)\s+(?:defined\s+as|known\s+as)\s+(.+)/,
  /\b([A-Z][A-Za-z][\w-]*(?:\s+[a-z][\w-]+){0,2})\s+refers?\s+to\s+(.+)/,
  /\b([A-Z][A-Za-z][\w-]*(?:\s+[a-z][\w-]+){0,2})\s+means?\s+(.+)/,
  /\bthe\s+term\s+["“]?([\w -]+)["”]?\s+(?:is|means|refers? to)\s+(.+)/i
]

function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+(?:["'’)\]]+)?/g) ?? []).map((s) => s.trim()).filter(Boolean)
}

interface RawTerm {
  term: string
  definition: string
  sourceQuote: string
  pageNumber: number
}

export function extractDefinitions(
  pages: Array<{ pageNumber: number; textContent: string | null }>
): RawTerm[] {
  const out: RawTerm[] = []
  const seen = new Set<string>()
  for (const page of pages) {
    if (!page.textContent) continue
    for (const sentence of splitSentences(page.textContent)) {
      if (sentence.length < 25 || sentence.length > 320) continue
      for (const re of DEFINITION_PATTERNS) {
        const m = sentence.match(re)
        if (!m) continue
        const term = m[1].trim().replace(/[,;:]$/, '')
        const definition = m[2].trim()
        const key = term.toLowerCase()
        if (term.length < 2 || term.length > 60 || definition.length < 8) continue
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ term, definition, sourceQuote: sentence, pageNumber: page.pageNumber })
        break
      }
    }
  }
  return out
}

export interface BuildGlossaryArgs {
  documentId: string
  pages: Array<{ pageNumber: number; textContent: string | null }>
  citationsFor: (page: number) => Record<CitationFormat, string>
  fallbackReason: 'no_api_key' | null
  maxTerms?: number
}

export function buildLocalGlossary(args: BuildGlossaryArgs): GlossaryResult {
  const { documentId, pages, citationsFor, fallbackReason } = args
  const maxTerms = args.maxTerms ?? 40
  const raw = extractDefinitions(pages)
  const terms: GlossaryTerm[] = raw.slice(0, maxTerms).map((t) => ({
    term: t.term,
    definition: t.definition,
    sourceQuote: t.sourceQuote,
    pageNumber: t.pageNumber,
    citations: citationsFor(t.pageNumber)
  }))
  // Alphabetize for a glossary feel.
  terms.sort((a, b) => a.term.toLowerCase().localeCompare(b.term.toLowerCase()))
  return { documentId, terms, fallbackReason }
}
