import { describe, it, expect } from 'vitest'
import { buildPdfGeometry, locateSnippetRects, type ItemBox } from './pdfWordGeometry'
import { tokenize } from './tokenize'

describe('buildPdfGeometry', () => {
  it('joins items into flat text with space/newline separators', () => {
    const items: ItemBox[] = [
      { text: 'Hello', left: 0, top: 0, width: 50, height: 10 },
      { text: 'world', left: 60, top: 0, width: 50, height: 10, hasEOL: true },
      { text: 'next', left: 0, top: 20, width: 40, height: 10 }
    ]
    const g = buildPdfGeometry(items, { width: 200, height: 100 })
    expect(g.flatText).toBe('Hello world\nnext')
  })

  it('produces one rect per word, keyed by tokenize() token index', () => {
    const items: ItemBox[] = [
      { text: 'Hello', left: 0, top: 0, width: 50, height: 10 },
      { text: 'world', left: 60, top: 0, width: 50, height: 10 }
    ]
    const g = buildPdfGeometry(items, { width: 200, height: 100 })
    const toks = tokenize(g.flatText)
    const wordIdx = toks.filter((t) => t.isWord).map((t) => t.index)
    expect(g.wordRects.map((w) => w.tokenIndex)).toEqual(wordIdx)
    for (const wr of g.wordRects) {
      expect(g.rectByToken.get(wr.tokenIndex)).toEqual(wr.rect)
    }
  })

  it('normalizes rects to 0..1 page space at the item position', () => {
    const items: ItemBox[] = [
      { text: 'word', left: 20, top: 10, width: 40, height: 10 }
    ]
    const g = buildPdfGeometry(items, { width: 200, height: 100 })
    expect(g.wordRects).toHaveLength(1)
    const r = g.wordRects[0].rect
    expect(r.x).toBeCloseTo(20 / 200, 5)
    expect(r.y).toBeCloseTo(10 / 100, 5)
    expect(r.width).toBeCloseTo(40 / 200, 5)
    expect(r.height).toBeCloseTo(10 / 100, 5)
  })

  it('subdivides a multi-word item proportionally by character', () => {
    // One item "ab cd" (5 chars) spanning x=0..100. "ab" = chars 0..2, "cd" = 3..5.
    const items: ItemBox[] = [{ text: 'ab cd', left: 0, top: 0, width: 100, height: 10 }]
    const g = buildPdfGeometry(items, { width: 100, height: 10 })
    expect(g.wordRects).toHaveLength(2)
    const [ab, cd] = g.wordRects
    expect(ab.rect.x).toBeCloseTo(0, 5)
    expect(ab.rect.width).toBeCloseTo(2 / 5, 5)
    expect(cd.rect.x).toBeCloseTo(3 / 5, 5)
    expect(cd.rect.width).toBeCloseTo(2 / 5, 5)
  })

  it('returns empty geometry for a zero-size page', () => {
    const items: ItemBox[] = [{ text: 'x', left: 0, top: 0, width: 10, height: 10 }]
    const g = buildPdfGeometry(items, { width: 0, height: 0 })
    expect(g.wordRects).toHaveLength(0)
    expect(g.flatText).toBe('x')
  })
})

describe('locateSnippetRects', () => {
  const items: ItemBox[] = [
    { text: 'Climate', left: 0, top: 0, width: 70, height: 10 },
    { text: 'change', left: 80, top: 0, width: 60, height: 10 },
    { text: 'is', left: 150, top: 0, width: 20, height: 10 },
    { text: 'accelerating', left: 180, top: 0, width: 120, height: 10, hasEOL: true },
    { text: 'across', left: 0, top: 20, width: 60, height: 10 },
    { text: 'the', left: 70, top: 20, width: 30, height: 10 },
    { text: 'globe', left: 110, top: 20, width: 55, height: 10 }
  ]
  const g = buildPdfGeometry(items, { width: 400, height: 100 })

  it('finds a snippet by word sequence despite whitespace differences', () => {
    // snippet uses collapsed whitespace; flat text has a newline.
    const rects = locateSnippetRects(g, 'change is accelerating across')
    expect(rects.length).toBe(4)
  })

  it('returns [] when the snippet is not on the page', () => {
    expect(locateSnippetRects(g, 'mitochondria powerhouse cell')).toEqual([])
  })

  it('anchors on the first words and tolerates a longer query tail', () => {
    const rects = locateSnippetRects(g, 'Climate change is accelerating across the globe entirely')
    expect(rects.length).toBeGreaterThanOrEqual(6)
  })
})
