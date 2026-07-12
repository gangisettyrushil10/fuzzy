import { describe, it, expect } from 'vitest'
import { buildSoundtrackLane } from '../src/main/services/spotify/moodMusicMap'
import type { AmbientClassification } from '../src/shared/types/api'

function classification(overrides: Partial<AmbientClassification> = {}): AmbientClassification {
  return {
    mood: 'calm',
    secondaryMood: null,
    genre: 'literary',
    type: 'fiction',
    intensity: 0.3,
    sceneTags: [],
    paletteHints: [],
    motion: 'drift',
    ...overrides
  }
}

describe('buildSoundtrackLane', () => {
  it('maps calm to a deep-focus lane', () => {
    const { lane, query } = buildSoundtrackLane(classification({ mood: 'calm' }))
    expect(lane).toBe('Deep focus')
    expect(query).toContain('instrumental')
  })

  it('maps tension to a cinematic-suspense lane', () => {
    const { lane } = buildSoundtrackLane(classification({ mood: 'tension' }))
    expect(lane).toBe('Cinematic suspense')
  })

  it('picks a more intense query variant above the intensity threshold', () => {
    const low = buildSoundtrackLane(classification({ mood: 'sadness', intensity: 0.1 }))
    const high = buildSoundtrackLane(classification({ mood: 'sadness', intensity: 0.9 }))
    expect(low.query).not.toBe(high.query)
  })

  it('layers a genre flavor word onto the base query', () => {
    const { query } = buildSoundtrackLane(classification({ mood: 'wonder', genre: 'fantasy' }))
    expect(query.startsWith('fantasy ')).toBe(true)
  })

  it('uses a concrete scene word in both the lane and search query', () => {
    const { lane, query } = buildSoundtrackLane(
      classification({ mood: 'tension', sceneTags: ['storm'] })
    )
    expect(lane).toBe('Storm tension')
    expect(query).toContain('stormy')
  })

  it('keeps scene selection intentional when several tags are present', () => {
    const { lane, query } = buildSoundtrackLane(
      classification({ mood: 'fear', sceneTags: ['city', 'battle', 'rain'] })
    )
    expect(lane).toBe('Rain fear')
    expect(query).toContain('rainy')
    expect(query).not.toContain('urban')
  })

  it('ignores unknown scene tags instead of injecting arbitrary AI text', () => {
    const { lane, query } = buildSoundtrackLane(
      classification({ mood: 'calm', sceneTags: ['drop table playlists'] })
    )
    expect(lane).toBe('Deep focus')
    expect(query).not.toContain('drop table')
  })

  it('falls back to the neutral lane for an unmapped-feeling mood', () => {
    const { lane } = buildSoundtrackLane(classification({ mood: 'neutral' }))
    expect(lane).toBe('Ambient focus')
  })
})
