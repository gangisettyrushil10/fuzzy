// PDF word geometry — the linchpin that lets per-word features (pacer sweep,
// complex-word underlines, precise thesis highlights) work on PDF, where pdf.js
// gives us no per-word boxes and wipes its text layer on every zoom.
//
// The DOM-specific part (reading the rendered text-layer spans' rects) lives in
// PdfPage; THIS module holds the pure subdivision math: given each item's box
// (in page-relative CSS px) plus its text, it builds the flat page text and a
// per-word rect map keyed by the SAME token indices that `tokenize(flatText)`
// produces. So a pacer active-word index, a complex-word token index, and a
// thesis snippet's token range all resolve to the same rects.
//
// Approximation (v1): a word's box is its slice of the containing item's box,
// proportional to character position. Good enough for highlight bands; exact
// glyph metrics can refine it later. Words that can't be placed are dropped
// (they degrade to no highlight rather than a wrong one).

import { normalizeRectsToPage } from './rects'
import type { NormalizedRect } from '../state/selectionStore'
import { findWordSequence, tokenize } from './tokenize'

// One rendered text item's box, already made relative to the page container
// (top-left origin, CSS px). `text` is the item's string; `hasEOL` mirrors
// pdf.js so we insert a newline (not a space) after it in the flat text.
export interface ItemBox {
  text: string
  left: number
  top: number
  width: number
  height: number
  hasEOL?: boolean
}

export interface WordRect {
  // token.index from tokenize(flatText) — a WORD token.
  tokenIndex: number
  rect: NormalizedRect
}

export interface PdfGeometry {
  flatText: string
  // One entry per placeable word token, in reading order.
  wordRects: WordRect[]
  // tokenIndex -> rect, for O(1) lookup by the pacer / highlighters.
  rectByToken: Map<number, NormalizedRect>
}

export function buildPdfGeometry(
  items: ReadonlyArray<ItemBox>,
  page: { width: number; height: number }
): PdfGeometry {
  let flat = ''
  const spans: Array<{ start: number; end: number; box: ItemBox }> = []

  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const start = flat.length
    flat += it.text
    const end = flat.length
    if (end > start) spans.push({ start, end, box: it })
    if (i < items.length - 1) flat += it.hasEOL ? '\n' : ' '
  }

  const wordRects: WordRect[] = []
  const rectByToken = new Map<number, NormalizedRect>()
  if (page.width <= 0 || page.height <= 0) {
    return { flatText: flat, wordRects, rectByToken }
  }

  const tokens = tokenize(flat)
  let si = 0
  for (const t of tokens) {
    if (!t.isWord) continue
    while (si < spans.length && spans[si].end <= t.start) si++
    const span = spans[si]
    if (!span || t.start < span.start) continue // word fell in a separator gap

    const itemLen = span.end - span.start
    if (itemLen <= 0 || span.box.width <= 0 || span.box.height <= 0) continue

    const charOffset = t.start - span.start
    const wordEnd = Math.min(t.end, span.end)
    const wordLen = wordEnd - t.start
    const leftPx = span.box.left + (charOffset / itemLen) * span.box.width
    const widthPx = (wordLen / itemLen) * span.box.width

    const norm = normalizeRectsToPage(
      [{ left: leftPx, top: span.box.top, width: widthPx, height: span.box.height }],
      { left: 0, top: 0, width: page.width, height: page.height }
    )[0]
    if (!norm) continue
    wordRects.push({ tokenIndex: t.index, rect: norm })
    rectByToken.set(t.index, norm)
  }

  return { flatText: flat, wordRects, rectByToken }
}

// Locate a quote snippet within a page's geometry and return the per-word rects
// that cover it — used to project a thesis search result onto the page. Matches
// by WORD SEQUENCE (not raw substring), so whitespace/newline differences
// between the stored snippet and the page's flat text don't matter. Anchors on
// the first few words for resilience; returns [] if not found on this page.
export function locateSnippetRects(geometry: PdfGeometry, snippet: string): NormalizedRect[] {
  const rects: NormalizedRect[] = []
  for (const tokenIndex of findWordSequence(geometry.flatText, snippet)) {
    const rect = geometry.rectByToken.get(tokenIndex)
    if (rect) rects.push(rect)
  }
  return rects
}
