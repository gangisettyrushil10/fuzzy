import type { AmbientClassification, AmbientMood } from '@shared/types/api'

export type MoodlightTimelineSource = 'preview' | 'cached' | 'rich'

interface MoodlightCandidate {
  signature: string
  firstSeenAt: number
  lastSeenAt: number
  hits: number
}

export interface MoodlightTimelineDecision {
  delayMs: number
  signature: string
}

const MAX_CANDIDATES = 8
const SAME_SIGNATURE_RICH_SETTLE_MS = 140

const SOURCE_SETTLE_MS: Record<MoodlightTimelineSource, number> = {
  preview: 0,
  cached: 220,
  rich: 560
}

const SWITCH_HOLD_MS: Record<MoodlightTimelineSource, number> = {
  preview: 820,
  cached: 360,
  rich: 520
}

const SWITCH_HITS: Record<MoodlightTimelineSource, number> = {
  preview: 3,
  cached: 1,
  rich: 1
}

const MOOD_FAMILY: Record<AmbientMood, string> = {
  love: 'warm',
  sadness: 'blue',
  joy: 'bright',
  mystery: 'shadow',
  tension: 'threat',
  calm: 'quiet',
  awe: 'wonder',
  fear: 'threat',
  anger: 'threat',
  grief: 'blue',
  hope: 'bright',
  wonder: 'wonder',
  nostalgia: 'warm',
  neutral: 'neutral'
}

const SCENE_FAMILY: Record<string, string> = {
  ocean: 'water',
  sea: 'water',
  shore: 'water',
  tide: 'water',
  harbor: 'water',
  rain: 'water',
  snow: 'cold',
  forest: 'woodland',
  woods: 'woodland',
  garden: 'woodland',
  grove: 'woodland',
  night: 'night',
  dusk: 'night',
  fog: 'night',
  mist: 'night',
  city: 'city',
  street: 'city',
  castle: 'old-world',
  gold: 'treasure',
  treasure: 'treasure',
  magic: 'magic',
  spell: 'magic',
  storm: 'storm',
  battle: 'storm',
  blood: 'danger',
  fire: 'ember',
  flame: 'ember',
  ember: 'ember',
  dawn: 'dawn'
}

function sceneFamily(sceneTags: readonly string[]): string {
  for (const tag of sceneTags) {
    const family = SCENE_FAMILY[tag.toLowerCase()]
    if (family) return family
  }
  return sceneTags[0]?.toLowerCase() ?? 'none'
}

function sceneFamilies(sceneTags: readonly string[]): Set<string> {
  const families = new Set<string>()
  for (const tag of sceneTags) {
    families.add(SCENE_FAMILY[tag.toLowerCase()] ?? tag.toLowerCase())
  }
  return families
}

function hasSharedSceneFamily(
  current: AmbientClassification,
  next: AmbientClassification
): boolean {
  const currentFamilies = sceneFamilies(current.sceneTags)
  if (currentFamilies.size === 0 || next.sceneTags.length === 0) return false
  return next.sceneTags.some((tag) =>
    currentFamilies.has(SCENE_FAMILY[tag.toLowerCase()] ?? tag.toLowerCase())
  )
}

function isRelatedMood(current: AmbientClassification, next: AmbientClassification): boolean {
  if (current.mood === next.mood) return true
  if (current.mood === next.secondaryMood || next.mood === current.secondaryMood) return true
  return MOOD_FAMILY[current.mood] === MOOD_FAMILY[next.mood]
}

function isNearbyClassification(
  current: AmbientClassification,
  next: AmbientClassification
): boolean {
  return isRelatedMood(current, next) && hasSharedSceneFamily(current, next)
}

export function moodlightVisualSignature(classification: AmbientClassification): string {
  return [
    classification.type,
    classification.mood,
    MOOD_FAMILY[classification.mood],
    sceneFamily(classification.sceneTags),
    classification.motion
  ].join(':')
}

export class MoodlightTimeline {
  private candidates: MoodlightCandidate[] = []

  reset(): void {
    this.candidates = []
  }

  plan(
    current: AmbientClassification | null,
    next: AmbientClassification,
    source: MoodlightTimelineSource,
    now = Date.now()
  ): MoodlightTimelineDecision {
    const signature = moodlightVisualSignature(next)
    const currentSignature = current ? moodlightVisualSignature(current) : null

    if (!current || currentSignature === signature) {
      this.clearCandidates()
      return {
        signature,
        delayMs: source === 'rich' && current ? SAME_SIGNATURE_RICH_SETTLE_MS : 0
      }
    }

    if (isNearbyClassification(current, next)) {
      this.clearCandidates()
      return {
        signature,
        delayMs: Math.min(SOURCE_SETTLE_MS[source], 180)
      }
    }

    const candidate = this.rememberCandidate(signature, now)
    const age = now - candidate.firstSeenAt
    const holdMs = SWITCH_HOLD_MS[source]
    const sustained = age >= holdMs || candidate.hits >= SWITCH_HITS[source]
    const settleMs = SOURCE_SETTLE_MS[source]

    if (sustained) {
      return { signature, delayMs: settleMs }
    }

    return {
      signature,
      delayMs: Math.max(120, holdMs - age) + settleMs
    }
  }

  noteCommitted(): void {
    this.clearCandidates()
  }

  private rememberCandidate(signature: string, now: number): MoodlightCandidate {
    const existing = this.candidates.find((candidate) => candidate.signature === signature)
    if (existing) {
      existing.hits += 1
      existing.lastSeenAt = now
      return existing
    }

    const candidate: MoodlightCandidate = {
      signature,
      firstSeenAt: now,
      lastSeenAt: now,
      hits: 1
    }
    this.candidates = [candidate, ...this.candidates]
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .slice(0, MAX_CANDIDATES)
    return candidate
  }

  private clearCandidates(): void {
    this.candidates = []
  }
}
