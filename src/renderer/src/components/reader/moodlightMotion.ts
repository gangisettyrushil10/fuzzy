import type { AmbientClassification, AmbientMotion } from '@shared/types/api'

export type MoodlightMotionProfileId =
  | 'storm'
  | 'battle-fire-blood'
  | 'ocean-rain-river'
  | 'magic-treasure-awe-wonder'
  | 'calm'
  | 'neutral'

export interface MoodlightMotionValues {
  speed: number
  energy: number
  turbulence: number
  pulse: number
  flow: number
  spread: number
}

export interface MoodlightStreakHints {
  density: number
  length: number
  speed: number
  opacity: number
}

export interface MoodlightBurstHints {
  frequency: number
  radius: number
  strength: number
}

export interface MoodlightMotionProfile extends MoodlightMotionValues {
  id: MoodlightMotionProfileId
  streaks?: MoodlightStreakHints
  bursts?: MoodlightBurstHints
}

const TAGS = {
  storm: new Set(['storm']),
  combat: new Set(['battle', 'fire', 'blood']),
  water: new Set(['ocean', 'rain', 'river']),
  luminous: new Set(['magic', 'treasure', 'gold']),
  quiet: new Set(['fog', 'night', 'snow'])
} as const

const MOTION_PACE: Record<AmbientMotion, number> = {
  still: -0.2,
  drift: -0.04,
  wave: 0.04,
  mist: -0.14,
  pulse: 0.14,
  shimmer: 0.07,
  embers: 0.18
}

const MOOD_ACTIVITY: Record<AmbientClassification['mood'], number> = {
  love: -0.02,
  sadness: -0.12,
  joy: 0.12,
  mystery: -0.02,
  tension: 0.18,
  calm: -0.18,
  awe: 0.04,
  fear: 0.08,
  anger: 0.2,
  grief: -0.16,
  hope: 0.03,
  wonder: 0.06,
  nostalgia: -0.08,
  neutral: -0.04
}

const BASE_PROFILES: Record<MoodlightMotionProfileId, MoodlightMotionProfile> = {
  storm: {
    id: 'storm',
    speed: 0.00009,
    energy: 0.66,
    turbulence: 0.58,
    pulse: 0.22,
    flow: 1.7,
    spread: 0.52,
    streaks: { density: 0.72, length: 0.82, speed: 1.72, opacity: 0.68 },
    bursts: { frequency: 0.62, radius: 0.72, strength: 0.82 }
  },
  'battle-fire-blood': {
    id: 'battle-fire-blood',
    speed: 0.000088,
    energy: 0.64,
    turbulence: 0.5,
    pulse: 0.24,
    flow: 1.52,
    spread: 0.5,
    streaks: { density: 0.6, length: 0.68, speed: 1.48, opacity: 0.62 },
    bursts: { frequency: 0.5, radius: 0.56, strength: 0.72 }
  },
  'ocean-rain-river': {
    id: 'ocean-rain-river',
    speed: 0.000058,
    energy: 0.4,
    turbulence: 0.16,
    pulse: 0.06,
    flow: 1.3,
    spread: 0.53,
    streaks: { density: 0.24, length: 0.72, speed: 0.82, opacity: 0.34 }
  },
  'magic-treasure-awe-wonder': {
    id: 'magic-treasure-awe-wonder',
    speed: 0.000064,
    energy: 0.48,
    turbulence: 0.22,
    pulse: 0.12,
    flow: 1.16,
    spread: 0.48,
    streaks: { density: 0.42, length: 0.48, speed: 1.08, opacity: 0.54 },
    bursts: { frequency: 0.28, radius: 0.5, strength: 0.48 }
  },
  calm: {
    id: 'calm',
    speed: 0.000032,
    energy: 0.2,
    turbulence: 0.06,
    pulse: 0.03,
    flow: 0.72,
    spread: 0.34
  },
  neutral: {
    id: 'neutral',
    speed: 0.000045,
    energy: 0.3,
    turbulence: 0.13,
    pulse: 0.06,
    flow: 1,
    spread: 0.42
  }
}

const RESPONSE: Record<MoodlightMotionProfileId, MoodlightMotionValues> = {
  storm: {
    speed: 0.42,
    energy: 0.28,
    turbulence: 0.22,
    pulse: 0.16,
    flow: 0.24,
    spread: 0.04
  },
  'battle-fire-blood': {
    speed: 0.4,
    energy: 0.3,
    turbulence: 0.22,
    pulse: 0.17,
    flow: 0.22,
    spread: 0.04
  },
  'ocean-rain-river': {
    speed: 0.3,
    energy: 0.2,
    turbulence: 0.14,
    pulse: 0.08,
    flow: 0.14,
    spread: 0.03
  },
  'magic-treasure-awe-wonder': {
    speed: 0.32,
    energy: 0.22,
    turbulence: 0.14,
    pulse: 0.1,
    flow: 0.14,
    spread: 0.03
  },
  calm: {
    speed: 0.14,
    energy: 0.12,
    turbulence: 0.06,
    pulse: 0.04,
    flow: 0.08,
    spread: 0.02
  },
  neutral: {
    speed: 0.28,
    energy: 0.2,
    turbulence: 0.12,
    pulse: 0.08,
    flow: 0.12,
    spread: 0.03
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function hasAnyTag(tags: Set<string>, options: ReadonlySet<string>): boolean {
  for (const option of options) {
    if (tags.has(option)) return true
  }
  return false
}

function chooseProfileId(classification: AmbientClassification): MoodlightMotionProfileId {
  const tags = new Set(classification.sceneTags.map((tag) => tag.toLowerCase()))
  const mood = classification.mood
  const secondaryMood = classification.secondaryMood
  const intensePulse =
    classification.motion === 'pulse' && classification.intensity >= 0.48 && mood !== 'calm'

  if (hasAnyTag(tags, TAGS.storm)) return 'storm'
  if (hasAnyTag(tags, TAGS.combat) || mood === 'anger' || classification.motion === 'embers') {
    return 'battle-fire-blood'
  }
  if ((mood === 'tension' || mood === 'fear') && intensePulse) return 'storm'
  if (hasAnyTag(tags, TAGS.water) || classification.motion === 'wave') return 'ocean-rain-river'
  if (
    hasAnyTag(tags, TAGS.luminous) ||
    mood === 'awe' ||
    mood === 'wonder' ||
    secondaryMood === 'awe' ||
    secondaryMood === 'wonder' ||
    classification.motion === 'shimmer'
  ) {
    return 'magic-treasure-awe-wonder'
  }
  if (
    hasAnyTag(tags, TAGS.quiet) ||
    mood === 'calm' ||
    mood === 'sadness' ||
    mood === 'grief' ||
    classification.motion === 'mist' ||
    classification.motion === 'still'
  ) {
    return 'calm'
  }
  return 'neutral'
}

function cloneProfile(profile: MoodlightMotionProfile): MoodlightMotionProfile {
  const next: MoodlightMotionProfile = {
    id: profile.id,
    speed: profile.speed,
    energy: profile.energy,
    turbulence: profile.turbulence,
    pulse: profile.pulse,
    flow: profile.flow,
    spread: profile.spread
  }

  if (profile.streaks) {
    next.streaks = { ...profile.streaks }
  }
  if (profile.bursts) {
    next.bursts = { ...profile.bursts }
  }

  return next
}

function scaleHints(profile: MoodlightMotionProfile, pace: number): MoodlightMotionProfile {
  const next = cloneProfile(profile)

  if (next.streaks) {
    next.streaks = {
      density: clamp01(next.streaks.density + pace * 0.12),
      length: clamp01(next.streaks.length + pace * 0.08),
      speed: clamp(next.streaks.speed + pace * 0.16, 0.65, 1.9),
      opacity: clamp01(next.streaks.opacity + pace * 0.1)
    }
  }

  if (next.bursts) {
    next.bursts = {
      frequency: clamp01(next.bursts.frequency + pace * 0.1),
      radius: clamp01(next.bursts.radius + pace * 0.08),
      strength: clamp01(next.bursts.strength + pace * 0.12)
    }
  }

  return next
}

export function resolveMoodlightMotionProfile(
  classification: AmbientClassification | null
): MoodlightMotionProfile {
  if (!classification) return cloneProfile(BASE_PROFILES.neutral)

  const profileId = chooseProfileId(classification)
  const base = BASE_PROFILES[profileId]
  const response = RESPONSE[profileId]
  const intensity = clamp01(classification.intensity)
  const pace =
    (intensity - 0.5) * 1.35 +
    MOTION_PACE[classification.motion] +
    MOOD_ACTIVITY[classification.mood]
  const motion = scaleHints(base, pace)

  motion.speed = clamp(base.speed * (1 + pace * response.speed), 0.000026, 0.000148)
  motion.energy = clamp01(base.energy + pace * response.energy)
  motion.turbulence = clamp01(base.turbulence + pace * response.turbulence)
  motion.pulse = clamp01(base.pulse + pace * response.pulse)
  motion.flow = clamp(base.flow + pace * response.flow, 0.62, 2.08)
  motion.spread = clamp(base.spread + pace * response.spread, 0.28, 0.58)

  return motion
}
