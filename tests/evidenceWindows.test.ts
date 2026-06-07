import { describe, it, expect } from 'vitest'
import { buildEvidenceWindows } from '../src/main/services/evidence/evidenceWindows'
import { segmentIntoChunks } from '../src/main/services/thesis/textSegmentation'

// ~30 sentences so the page exceeds several window boundaries.
const PARA = 'Elizabeth and Darcy walked together along the quiet lane. '.repeat(8).trim()
const PAGE = [PARA, PARA, PARA].join('\n\n')

describe('buildEvidenceWindows', () => {
  it('produces coarse, multi-sentence windows that preserve page numbers', () => {
    const windows = buildEvidenceWindows([{ pageNumber: 7, textContent: PAGE }])
    expect(windows.length).toBeGreaterThan(0)
    for (const w of windows) {
      expect(w.pageNumber).toBe(7)
      expect(w.tokens.length).toBeGreaterThan(0)
      expect(w.text.length).toBeLessThanOrEqual(1300)
    }
  })

  it('is coarser than the sentence-level chunker', () => {
    const windows = buildEvidenceWindows([{ pageNumber: 1, textContent: PAGE }])
    const chunks = segmentIntoChunks(PAGE)
    expect(windows.length).toBeLessThan(chunks.length)
  })

  it('skips empty pages', () => {
    expect(buildEvidenceWindows([{ pageNumber: 1, textContent: null }])).toEqual([])
    expect(buildEvidenceWindows([{ pageNumber: 1, textContent: '   ' }])).toEqual([])
  })
})
