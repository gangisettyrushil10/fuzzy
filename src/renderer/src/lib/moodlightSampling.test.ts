import { describe, expect, it } from 'vitest'
import { moodlightClassificationDelay, moodlightExcerptChars } from './moodlightSampling'

describe('moodlight passage sampling', () => {
  it('uses tighter passage windows at higher responsiveness', () => {
    expect(moodlightExcerptChars(0.9)).toBeLessThan(moodlightExcerptChars(0.2))
    expect(moodlightExcerptChars(0.9)).toBeGreaterThanOrEqual(400)
  })

  it('settles classifications sooner without becoming instant', () => {
    expect(moodlightClassificationDelay(0.9)).toBeLessThan(moodlightClassificationDelay(0.2))
    expect(moodlightClassificationDelay(1)).toBeGreaterThanOrEqual(400)
    expect(moodlightClassificationDelay(1, true)).toBeGreaterThanOrEqual(160)
  })

  it('clamps invalid preference values', () => {
    expect(moodlightExcerptChars(Number.NaN)).toBe(moodlightExcerptChars(0.5))
    expect(moodlightClassificationDelay(3)).toBe(moodlightClassificationDelay(1))
  })
})
