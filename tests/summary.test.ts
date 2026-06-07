import { describe, it, expect } from 'vitest'
import {
  segmentChapters,
  targetWordsForMinutes,
  buildMockChapterSummaries,
  buildMockDigest
} from '../src/main/services/summary/summaryMock'
import type { PageRecord } from '../src/shared/types/database'

function page(n: number, text: string): PageRecord {
  return {
    id: `p${n}`,
    documentId: 'd1',
    pageNumber: n,
    textContent: text,
    estimatedWordCount: text.split(/\s+/).filter(Boolean).length,
    complexityScore: 0,
    createdAt: 't'
  }
}

describe('targetWordsForMinutes', () => {
  it('scales with minutes and clamps', () => {
    expect(targetWordsForMinutes(10)).toBe(2000)
    expect(targetWordsForMinutes(0)).toBe(150) // clamped floor
    expect(targetWordsForMinutes(999)).toBe(5000) // clamped ceiling
  })
})

describe('segmentChapters', () => {
  it('reflowable: one chapter per section, title from first line', () => {
    const pages = [page(1, 'Chapter One\nIt was a bright day.'), page(2, 'Chapter Two\nThen night fell.')]
    const chapters = segmentChapters(pages, 'epub')
    expect(chapters).toHaveLength(2)
    expect(chapters[0].title).toBe('Chapter One')
    expect(chapters[0].pageNumber).toBe(1)
  })

  it('pdf: groups consecutive pages into chapters with page-range titles', () => {
    const pages = Array.from({ length: 14 }, (_, i) => page(i + 1, 'word '.repeat(50)))
    const chapters = segmentChapters(pages, 'pdf')
    expect(chapters.length).toBeGreaterThan(1)
    expect(chapters.length).toBeLessThanOrEqual(24)
    expect(chapters[0].title).toMatch(/^Pages? /)
  })

  it('caps very long section lists at 24 chapters', () => {
    const pages = Array.from({ length: 100 }, (_, i) => page(i + 1, `Section ${i + 1} body text`))
    const chapters = segmentChapters(pages, 'txt')
    expect(chapters.length).toBeLessThanOrEqual(24)
  })

  it('ignores empty pages', () => {
    expect(segmentChapters([page(1, '   '), page(2, '')], 'pdf')).toEqual([])
  })
})

describe('mock builders', () => {
  it('digest carries target sizing + structure', () => {
    const d = buildMockDigest('d1', 'My Doc', 'Some long body text here.', 10)
    expect(d.targetMinutes).toBe(10)
    expect(d.targetWords).toBe(2000)
    expect(d.text).toContain('My Doc')
  })

  it('chapter mock returns one summary per chapter', () => {
    const chapters = segmentChapters([page(1, 'A\nbody'), page(2, 'B\nbody')], 'epub')
    const r = buildMockChapterSummaries('d1', chapters)
    expect(r.chapters).toHaveLength(2)
    expect(r.chapters[0].title).toBe('A')
  })
})
