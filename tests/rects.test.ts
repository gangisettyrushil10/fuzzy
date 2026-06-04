import { describe, expect, it } from 'vitest'
import { normalizeRectsToPage } from '../src/renderer/src/lib/rects'

describe('normalizeRectsToPage', () => {
  const page = { left: 100, top: 50, width: 800, height: 1000 }

  it('produces 0..1 page-relative coords for a single rect', () => {
    const rects = [{ left: 300, top: 250, width: 200, height: 100 }]
    const out = normalizeRectsToPage(rects, page)
    expect(out).toEqual([
      { x: (300 - 100) / 800, y: (250 - 50) / 1000, width: 200 / 800, height: 100 / 1000 }
    ])
  })

  it('drops zero-area rects (cursor positions)', () => {
    const rects = [
      { left: 300, top: 250, width: 0, height: 0 },
      { left: 320, top: 250, width: 50, height: 20 }
    ]
    const out = normalizeRectsToPage(rects, page)
    expect(out.length).toBe(1)
    expect(out[0].width).toBeGreaterThan(0)
  })

  it('clamps to [0,1] when a rect leaks past the page edge', () => {
    const rects = [{ left: 900, top: 1100, width: 200, height: 100 }]
    const out = normalizeRectsToPage(rects, page)
    expect(out[0].x).toBeGreaterThanOrEqual(0)
    expect(out[0].x).toBeLessThanOrEqual(1)
    expect(out[0].y).toBeGreaterThanOrEqual(0)
    expect(out[0].y).toBeLessThanOrEqual(1)
    expect(out[0].width).toBeLessThanOrEqual(1)
    expect(out[0].height).toBeLessThanOrEqual(1)
  })

  it('returns empty when the page has zero size', () => {
    expect(
      normalizeRectsToPage([{ left: 0, top: 0, width: 10, height: 10 }], {
        left: 0,
        top: 0,
        width: 0,
        height: 100
      })
    ).toEqual([])
  })

  it('returns multiple rects for a multi-line selection', () => {
    const rects = [
      { left: 200, top: 250, width: 600, height: 20 },
      { left: 100, top: 280, width: 700, height: 20 },
      { left: 100, top: 310, width: 300, height: 20 }
    ]
    const out = normalizeRectsToPage(rects, page)
    expect(out.length).toBe(3)
  })
})
