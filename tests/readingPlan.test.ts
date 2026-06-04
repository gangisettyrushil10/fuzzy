import { describe, expect, it } from 'vitest'
import { generateReadingPlan } from '../src/main/services/readingPlanService'
import type { PageRecord } from '../src/shared/types/database'

function makePages(words: number[]): PageRecord[] {
  return words.map((w, i) => ({
    id: `p${i + 1}`,
    documentId: 'doc',
    pageNumber: i + 1,
    textContent: 'x '.repeat(w).trim(),
    estimatedWordCount: w,
    complexityScore: 0,
    createdAt: '2026-01-01T00:00:00Z'
  }))
}

describe('generateReadingPlan', () => {
  it('returns an empty plan when there are no pages', () => {
    const plan = generateReadingPlan({
      documentId: 'doc',
      availableMinutes: 30,
      pages: []
    })
    expect(plan.sections).toEqual([])
    expect(plan.estimatedMinutes).toBe(0)
  })

  it('chooses all deep_read when time budget exceeds the document length', () => {
    const pages = makePages([200, 200, 200])
    const plan = generateReadingPlan({
      documentId: 'doc',
      availableMinutes: 60,
      pages
    })
    expect(plan.strategy).toBe('deep_read')
    expect(plan.sections.every((s) => s.mode === 'deep_read')).toBe(true)
    expect(plan.estimatedMinutes).toBeLessThanOrEqual(60)
  })

  it('mixes deep_read and skim when time is tight', () => {
    // 12 pages × 800 words = 9600 words → 48 min deep read.
    // Budget 20 min should force some skimming.
    const pages = makePages(Array(12).fill(800))
    const plan = generateReadingPlan({
      documentId: 'doc',
      availableMinutes: 20,
      pages
    })
    const modes = new Set(plan.sections.flatMap((s) => [s.mode]))
    expect(modes.has('deep_read')).toBe(true)
    expect(modes.size).toBeGreaterThan(1)
  })

  it('compacts adjacent same-mode pages into a single section', () => {
    const pages = makePages([100, 100, 100, 100, 100])
    const plan = generateReadingPlan({
      documentId: 'doc',
      availableMinutes: 60,
      pages
    })
    // All deep_read → must be one section spanning 1..5.
    expect(plan.sections.length).toBe(1)
    expect(plan.sections[0].pageStart).toBe(1)
    expect(plan.sections[0].pageEnd).toBe(5)
  })

  it('always allocates at least two deep-read pages even on a tiny budget', () => {
    const pages = makePages(Array(20).fill(500))
    const plan = generateReadingPlan({
      documentId: 'doc',
      availableMinutes: 3,
      pages
    })
    const deepPages = plan.sections
      .filter((s) => s.mode === 'deep_read')
      .reduce((sum, s) => sum + (s.pageEnd - s.pageStart + 1), 0)
    expect(deepPages).toBeGreaterThanOrEqual(2)
  })

  it('produces sections that cover every page exactly once', () => {
    const pages = makePages([300, 700, 200, 900, 100, 600])
    const plan = generateReadingPlan({
      documentId: 'doc',
      availableMinutes: 15,
      pages
    })
    const seen = new Set<number>()
    for (const s of plan.sections) {
      for (let i = s.pageStart; i <= s.pageEnd; i++) {
        expect(seen.has(i)).toBe(false)
        seen.add(i)
      }
    }
    expect(seen.size).toBe(pages.length)
  })

  it('reports estimated minutes that respect the budget', () => {
    const pages = makePages(Array(8).fill(500))
    const plan = generateReadingPlan({
      documentId: 'doc',
      availableMinutes: 10,
      pages
    })
    expect(plan.estimatedMinutes).toBeLessThanOrEqual(plan.availableMinutes + 0.5)
  })
})
