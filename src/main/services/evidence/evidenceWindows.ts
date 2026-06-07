// Pure coarse windowing for evidence retrieval (no electron/openai/db imports —
// unit-tested). Relationship/claim evidence needs multi-sentence spans, unlike
// the 40–320 char citation chunks in textSegmentation. Windows are paragraph-
// preferring, ~600–1200 chars; a chapter-sized reflowable "page" sub-windows
// automatically. Reuses tokenizeForSearch so the BM25 vocabulary matches.

import { tokenizeForSearch } from '../thesis/textSegmentation'

export interface EvidenceWindow {
  pageNumber: number
  windowIndex: number
  text: string
  tokens: string[]
}

const MIN_WINDOW_CHARS = 600
const MAX_WINDOW_CHARS = 1200

function splitSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+(?:["'’)\]]+)?|\S[^.!?]*$/g) ?? [text]
}

function windowsForPage(pageNumber: number, text: string, startIndex: number): EvidenceWindow[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim()
  if (!normalized) return []

  const paragraphs = normalized.split(/\n{2,}/)
  const out: EvidenceWindow[] = []
  let buffer = ''
  let index = startIndex

  const flush = (): void => {
    const t = buffer.trim()
    if (t) {
      out.push({ pageNumber, windowIndex: index, text: t, tokens: tokenizeForSearch(t) })
      index += 1
    }
    buffer = ''
  }

  const addUnit = (unit: string): void => {
    const u = unit.trim()
    if (!u) return
    if (u.length > MAX_WINDOW_CHARS) {
      // Hard-split an over-long unit at sentence boundaries.
      flush()
      let chunk = ''
      for (const sentence of splitSentences(u)) {
        if ((chunk + ' ' + sentence).length > MAX_WINDOW_CHARS && chunk) {
          buffer = chunk
          flush()
          chunk = sentence.trim()
        } else {
          chunk = chunk ? `${chunk} ${sentence.trim()}` : sentence.trim()
        }
      }
      if (chunk) buffer = chunk
      return
    }
    if ((buffer + '\n\n' + u).length > MAX_WINDOW_CHARS && buffer) flush()
    buffer = buffer ? `${buffer}\n\n${u}` : u
    if (buffer.length >= MIN_WINDOW_CHARS) flush()
  }

  for (const para of paragraphs) addUnit(para)
  flush()
  return out
}

// Build windows for a set of pages. windowIndex is unique per page (stable id
// component); pass only the pages you intend to search (e.g. co-mention pages).
export function buildEvidenceWindows(
  pages: Array<{ pageNumber: number; textContent: string | null }>
): EvidenceWindow[] {
  const out: EvidenceWindow[] = []
  for (const page of pages) {
    if (!page.textContent) continue
    out.push(...windowsForPage(page.pageNumber, page.textContent, 0))
  }
  return out
}
