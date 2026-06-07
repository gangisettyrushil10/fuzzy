import { describe, it, expect } from 'vitest'
import { tokenize } from './tokenize'
import { analyzeComplexity, estimateSyllables } from './complexity'

// A tiny common-word predicate for tests (the real one loads a bundled list).
const COMMON = new Set([
  'the', 'a', 'cat', 'sat', 'on', 'mat', 'and', 'was', 'very', 'happy', 'this',
  'is', 'water', 'house', 'people', 'because'
])
const isCommon = (w: string): boolean => COMMON.has(w)

describe('estimateSyllables', () => {
  it('counts vowel groups with a floor of 1', () => {
    expect(estimateSyllables('cat')).toBe(1)
    expect(estimateSyllables('water')).toBe(2)
    expect(estimateSyllables('beautiful')).toBeGreaterThanOrEqual(3)
    expect(estimateSyllables('photosynthesis')).toBeGreaterThanOrEqual(4)
  })
})

describe('analyzeComplexity', () => {
  it('off returns nothing', () => {
    const r = analyzeComplexity(tokenize('photosynthesis indefatigable'), 'off', isCommon)
    expect(r.complexIndices.size).toBe(0)
    expect(r.pageScore).toBe(0)
  })

  it('flags long/multi-syllable uncommon words but not common ones', () => {
    const toks = tokenize('The cat sat on the mat, photosynthesis indefatigable.')
    const r = analyzeComplexity(toks, 'subtle', isCommon)
    const flagged = [...r.complexIndices].map((i) => toks[i].text)
    expect(flagged).toContain('photosynthesis')
    expect(flagged).toContain('indefatigable')
    expect(flagged).not.toContain('cat')
    expect(flagged).not.toContain('the')
  })

  it('skips numbers, ALL-CAPS acronyms, and short words', () => {
    const toks = tokenize('NASA sent 12345 to ESA quickly')
    const r = analyzeComplexity(toks, 'aggressive', isCommon)
    const flagged = [...r.complexIndices].map((i) => toks[i].text)
    expect(flagged).not.toContain('NASA')
    expect(flagged).not.toContain('ESA')
    expect(flagged).not.toContain('12345')
  })

  it('treats mid-sentence Capitalized words as proper nouns (skipped)', () => {
    // "Washington" mid-sentence = name; sentence-initial "Constantinople" is fair game.
    const toks = tokenize('We visited Washington. Constantinople fascinated everyone.')
    const r = analyzeComplexity(toks, 'aggressive', isCommon)
    const flagged = [...r.complexIndices].map((i) => toks[i].text)
    expect(flagged).not.toContain('Washington')
    expect(flagged).toContain('Constantinople')
  })

  it('aggressive flags more than subtle', () => {
    const toks = tokenize('The committee deliberated extensively yesterday afternoon.')
    const subtle = analyzeComplexity(toks, 'subtle', isCommon).complexIndices.size
    const aggressive = analyzeComplexity(toks, 'aggressive', isCommon).complexIndices.size
    expect(aggressive).toBeGreaterThanOrEqual(subtle)
  })
})
