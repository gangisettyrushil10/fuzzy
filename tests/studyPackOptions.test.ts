import { describe, it, expect } from 'vitest'
import {
  DEFAULT_STUDY_PACK_OPTIONS,
  categoriesForGenre,
  normalizeStudyPackOptions,
  normalizeStudyPackPrefs
} from '../src/shared/types/database'

describe('categoriesForGenre', () => {
  it('offers narrative categories for fiction', () => {
    expect(categoriesForGenre('fiction')).toContain('plot')
    expect(categoriesForGenre('fiction')).toContain('tone')
  })

  it('offers academic categories for papers', () => {
    const cats = categoriesForGenre('paper')
    expect(cats).toContain('arguments')
    expect(cats).toContain('evidence')
  })

  it('falls back to a universal set for unknown/null genre', () => {
    expect(categoriesForGenre(null)).toContain('general')
  })
})

describe('normalizeStudyPackOptions', () => {
  it('returns defaults for junk input', () => {
    expect(normalizeStudyPackOptions(null)).toEqual(DEFAULT_STUDY_PACK_OPTIONS)
    expect(normalizeStudyPackOptions('nope')).toEqual(DEFAULT_STUDY_PACK_OPTIONS)
  })

  it('clamps counts to their limits', () => {
    const o = normalizeStudyPackOptions({ quizCount: 999, flashcardCount: 0 })
    expect(o.quizCount).toBe(25)
    expect(o.flashcardCount).toBe(3)
  })

  it('drops invalid enum values and dedupes', () => {
    const o = normalizeStudyPackOptions({
      difficulties: ['easy', 'easy', 'nonsense'],
      formats: ['multiple_choice', 'bogus'],
      categories: ['plot', 'plot', 'not-a-category']
    })
    expect(o.difficulties).toEqual(['easy'])
    expect(o.formats).toEqual(['multiple_choice'])
    expect(o.categories).toEqual(['plot'])
  })

  it('falls back to defaults when a whitelist filters everything out', () => {
    const o = normalizeStudyPackOptions({ difficulties: ['bad'], formats: [], categories: [] })
    expect(o.difficulties).toEqual(DEFAULT_STUDY_PACK_OPTIONS.difficulties)
    expect(o.formats).toEqual(DEFAULT_STUDY_PACK_OPTIONS.formats)
    expect(o.categories).toEqual(DEFAULT_STUDY_PACK_OPTIONS.categories)
  })

  it('normalizes a page range to a valid ordered window', () => {
    const o = normalizeStudyPackOptions({ pageRange: { start: 30, end: 10 } })
    expect(o.pageRange).toEqual({ start: 10, end: 30 })
  })

  it('caps the focus note length', () => {
    const o = normalizeStudyPackOptions({ focusNote: 'x'.repeat(1000) })
    expect(o.focusNote?.length).toBe(400)
  })
})

describe('normalizeStudyPackPrefs', () => {
  it('validates the export format and nests option normalization', () => {
    const p = normalizeStudyPackPrefs({
      defaultExportFormat: 'bogus',
      spacedRepetitionEnabled: 'yes',
      lastOptions: { quizCount: 1000 }
    })
    expect(p.defaultExportFormat).toBe('quizlet')
    expect(p.spacedRepetitionEnabled).toBe(true)
    expect(p.lastOptions.quizCount).toBe(25)
  })
})
