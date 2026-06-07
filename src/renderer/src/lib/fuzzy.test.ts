import { describe, it, expect } from 'vitest'
import { fuzzyScore, fuzzyFilter } from './fuzzy'

describe('fuzzyScore', () => {
  it('matches subsequences and rejects non-subsequences', () => {
    expect(fuzzyScore('gtp', 'Go to page')).not.toBeNull()
    expect(fuzzyScore('xyz', 'Go to page')).toBeNull()
  })

  it('empty query scores 0 (keeps everything)', () => {
    expect(fuzzyScore('', 'anything')).toBe(0)
  })

  it('rewards contiguous and word-boundary matches', () => {
    // "open" contiguous at a word start beats scattered letters.
    const contiguous = fuzzyScore('open', 'Open settings')!
    const scattered = fuzzyScore('open', 'one part enables')
    expect(contiguous).not.toBeNull()
    // scattered may or may not match; if it does, contiguous wins.
    if (scattered !== null) expect(contiguous).toBeGreaterThan(scattered)
  })
})

describe('fuzzyFilter', () => {
  const items = ['Import PDF', 'Open Settings', 'Plan study session', 'Open study pack']

  it('returns all (original order) for empty query', () => {
    expect(fuzzyFilter('', items, (s) => s)).toEqual(items)
  })

  it('filters and ranks by relevance', () => {
    const r = fuzzyFilter('open', items, (s) => s)
    expect(r.every((s) => s.toLowerCase().includes('o'))).toBe(true)
    expect(r[0]).toMatch(/^Open/)
  })

  it('drops non-matches', () => {
    expect(fuzzyFilter('zzz', items, (s) => s)).toEqual([])
  })
})
