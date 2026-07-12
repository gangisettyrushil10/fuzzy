import { describe, expect, it } from 'vitest'
import type { AmbientClassification } from '@shared/types/api'
import { getMoodlightPalette, vividRgb, type MoodlightRgb } from './moodlightColor'
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

function averageLuminance(colors: MoodlightRgb[]): number {
  return (
    colors.reduce(
      (sum, [red, green, blue]) => sum + red * 0.2126 + green * 0.7152 + blue * 0.0722,
      0
    ) / colors.length
  )
}

function averageChroma(colors: MoodlightRgb[]): number {
  return (
    colors.reduce((sum, color) => sum + Math.max(...color) - Math.min(...color), 0) / colors.length
  )
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

  it('keeps subdued passages dimmer and less chromatic than joyful passages', () => {
    const grief = getMoodlightPalette({
      ...BASE_CLASSIFICATION,
      mood: 'grief',
      intensity: 0.62,
      sceneTags: ['rain'],
      paletteHints: ['slate', 'silver']
    })
    const joy = getMoodlightPalette({
      ...BASE_CLASSIFICATION,
      mood: 'joy',
      intensity: 0.62,
      sceneTags: ['garden'],
      paletteHints: ['sunrise', 'gold']
    })

    expect(averageLuminance(joy.colors)).toBeGreaterThan(averageLuminance(grief.colors))
    expect(averageChroma(joy.colors)).toBeGreaterThan(averageChroma(grief.colors))
    expect(joy.presence).toBeGreaterThan(grief.presence)
  })

  it('preserves neutral colors instead of forcing them into a neon hue', () => {
    const white = vividRgb([255, 255, 255])

    expect(Math.max(...white) - Math.min(...white)).toBeLessThan(2)
  })

  it('scales motion with passage intensity inside the same scene family', () => {
    const quietStorm = resolveMoodlightMotionProfile({
      ...BASE_CLASSIFICATION,
      mood: 'mystery',
      intensity: 0.2,
      sceneTags: ['storm'],
      motion: 'mist'
    })
    const violentStorm = resolveMoodlightMotionProfile({
      ...BASE_CLASSIFICATION,
      mood: 'tension',
      intensity: 0.9,
      sceneTags: ['storm'],
      motion: 'pulse'
    })

    expect(violentStorm.energy).toBeGreaterThan(quietStorm.energy)
    expect(violentStorm.speed).toBeGreaterThan(quietStorm.speed)
    expect(violentStorm.pulse).toBeGreaterThan(quietStorm.pulse)
    expect(violentStorm.speed).toBeLessThanOrEqual(0.000084)
  })
})
