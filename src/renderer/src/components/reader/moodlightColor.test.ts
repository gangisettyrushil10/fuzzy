import { describe, expect, it } from 'vitest'
import type { AmbientClassification } from '@shared/types/api'
import { getMoodlightPalette } from './moodlightColor'
import { resolveMoodlightMotionProfile } from './moodlightMotion'

const BASE_CLASSIFICATION: AmbientClassification = {
  mood: 'neutral',
  secondaryMood: null,
  genre: 'literary',
  type: 'fiction',
  intensity: 0.5,
  sceneTags: [],
  paletteHints: [],
  motion: 'drift'
}

describe('moodlight color and motion', () => {
  it('turns arbitrary palette hints into stable vivid spectrum colors', () => {
    const classification: AmbientClassification = {
      ...BASE_CLASSIFICATION,
      mood: 'wonder',
      genre: 'sci-fi',
      paletteHints: ['xenon glow', 'laser bloom', 'quantum dusk']
    }

    const first = getMoodlightPalette(classification).colors
    const second = getMoodlightPalette(classification).colors

    expect(first).toEqual(second)
    expect(first.every((color) => Math.max(...color) >= 180)).toBe(true)
  })

  it('gives fast scenes more motion than calm scenes', () => {
    const storm = resolveMoodlightMotionProfile({
      ...BASE_CLASSIFICATION,
      mood: 'tension',
      intensity: 0.75,
      sceneTags: ['storm'],
      motion: 'pulse'
    })
    const calm = resolveMoodlightMotionProfile({
      ...BASE_CLASSIFICATION,
      mood: 'calm',
      intensity: 0.28,
      sceneTags: ['fog'],
      motion: 'mist'
    })

    expect(storm.energy).toBeGreaterThan(calm.energy)
    expect(storm.speed).toBeGreaterThan(calm.speed)
    expect(storm.turbulence).toBeGreaterThan(calm.turbulence)
  })
})
