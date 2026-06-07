import { describe, it, expect } from 'vitest'
import { availableTones, resolveTone, scoreText } from '../src/main/services/tone/toneLexicon'

describe('resolveTone', () => {
  it('maps tone phrasing to a canonical tone with diction', () => {
    const r = resolveTone('find the melancholy passages')
    expect(r.tone).toBe('melancholic')
    expect(r.words.length).toBeGreaterThan(0)
  })

  it('maps synonyms (scary -> fearful)', () => {
    expect(resolveTone('scary parts').tone).toBe('fearful')
  })

  it('returns no words for an unknown tone', () => {
    expect(resolveTone('zorp').words).toEqual([])
  })
})

describe('scoreText', () => {
  const { words } = resolveTone('melancholic')

  it('scores tone-bearing prose above neutral prose and returns matched words', () => {
    const moody = scoreText('A wistful silence, the faded light of dusk, a distant memory.', words)
    const neutral = scoreText('The committee approved the quarterly budget on Tuesday.', words)
    expect(moody.score).toBeGreaterThan(neutral.score)
    expect(moody.matched.length).toBeGreaterThan(0)
    expect(neutral.score).toBe(0)
  })

  it('returns 0 when there are no tone words', () => {
    expect(scoreText('anything at all', []).score).toBe(0)
  })
})

describe('availableTones', () => {
  it('exposes the tone catalog', () => {
    expect(availableTones()).toContain('melancholic')
    expect(availableTones().length).toBeGreaterThan(5)
  })
})
