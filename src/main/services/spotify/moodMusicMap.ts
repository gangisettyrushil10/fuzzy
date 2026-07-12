import type { AmbientClassification, AmbientGenre, AmbientMood } from '@shared/types/api'

export interface SoundtrackLane {
  lane: string
  query: string
}

interface SceneFlavor {
  label: string
  query: string
}

// Search-query templates per mood, ordered calm -> intense within each lane so
// intensity can pick a variant without changing the lane's identity. Built
// from Spotify's free-text playlist search rather than the deprecated
// Recommendations/Audio-Features endpoints (see spotify blog 2024-11-27).
const MOOD_LANES: Record<AmbientMood, { lane: string; queries: [string, string] }> = {
  calm: { lane: 'Deep focus', queries: ['calm instrumental focus', 'peaceful piano ambient'] },
  tension: {
    lane: 'Cinematic suspense',
    queries: ['dark ambient tension', 'cinematic suspense score']
  },
  wonder: {
    lane: 'Fantasy shimmer',
    queries: ['ambient electronic shimmer', 'orchestral fantasy score']
  },
  awe: { lane: 'Epic orchestral', queries: ['cinematic orchestral', 'epic sweeping soundtrack'] },
  sadness: { lane: 'Soft piano', queries: ['soft piano instrumental', 'rainy day ambient piano'] },
  grief: {
    lane: 'Slow piano',
    queries: ['melancholy piano instrumental', 'somber ambient instrumental']
  },
  joy: {
    lane: 'Warm acoustic',
    queries: ['warm acoustic instrumental', 'upbeat feel good instrumental']
  },
  hope: {
    lane: 'Uplifting instrumental',
    queries: ['uplifting piano instrumental', 'hopeful cinematic instrumental']
  },
  mystery: {
    lane: 'Noir electronic',
    queries: ['noir jazz instrumental', 'minimal dark electronic']
  },
  fear: { lane: 'Dark pulse', queries: ['tense minimal electronic', 'dark ambient horror score'] },
  love: {
    lane: 'Intimate piano',
    queries: ['romantic piano instrumental', 'intimate acoustic instrumental']
  },
  anger: {
    lane: 'Intense cinematic',
    queries: ['intense cinematic score', 'aggressive dark electronic']
  },
  nostalgia: {
    lane: 'Nostalgic warmth',
    queries: ['nostalgic instrumental', 'warm analog synth ambient']
  },
  neutral: {
    lane: 'Ambient focus',
    queries: ['ambient instrumental focus', 'quiet background instrumental']
  }
}

// Light flavor words layered onto the base query from the passage's detected
// genre, so a "wonder" passage in a sci-fi novel searches differently than
// "wonder" in a fantasy one.
const GENRE_FLAVOR: Partial<Record<AmbientGenre, string>> = {
  fantasy: 'fantasy',
  'sci-fi': 'sci-fi electronic',
  thriller: 'thriller',
  mystery: 'noir',
  romance: 'romantic',
  adventure: 'adventure'
}

// Mood describes the emotional lane; scene words make the search feel tied to
// what is actually happening in the visible passage. The order mirrors the
// ambient system's dominant-family priority so mixed scenes stay intentional.
const SCENE_FLAVOR: Record<string, SceneFlavor> = {
  storm: { label: 'Storm', query: 'stormy' },
  magic: { label: 'Magic', query: 'magical' },
  ocean: { label: 'Ocean', query: 'oceanic' },
  river: { label: 'River', query: 'flowing water' },
  rain: { label: 'Rain', query: 'rainy' },
  fire: { label: 'Fire', query: 'fiery' },
  battle: { label: 'Battle', query: 'battle' },
  blood: { label: 'Blood', query: 'dark gothic' },
  castle: { label: 'Castle', query: 'medieval' },
  forest: { label: 'Forest', query: 'woodland' },
  garden: { label: 'Garden', query: 'pastoral' },
  night: { label: 'Night', query: 'nocturnal' },
  fog: { label: 'Fog', query: 'misty' },
  snow: { label: 'Snow', query: 'winter' },
  dawn: { label: 'Dawn', query: 'sunrise' },
  dusk: { label: 'Dusk', query: 'twilight' },
  gold: { label: 'Gold', query: 'radiant' },
  city: { label: 'City', query: 'urban' }
}

const SCENE_PRIORITY = [
  'storm',
  'magic',
  'ocean',
  'river',
  'rain',
  'fire',
  'battle',
  'blood',
  'castle',
  'forest',
  'garden',
  'night',
  'fog',
  'snow',
  'dawn',
  'dusk',
  'gold',
  'city'
] as const

function dominantScene(sceneTags: readonly string[]): SceneFlavor | null {
  const normalized = new Set(sceneTags.map((tag) => tag.trim().toLowerCase()))
  const tag = SCENE_PRIORITY.find((candidate) => normalized.has(candidate))
  return tag ? SCENE_FLAVOR[tag] : null
}

export function buildSoundtrackLane(classification: AmbientClassification): SoundtrackLane {
  const base = MOOD_LANES[classification.mood] ?? MOOD_LANES.neutral
  const baseQuery = base.queries[classification.intensity > 0.55 ? 1 : 0]
  const flavor = GENRE_FLAVOR[classification.genre]
  const scene = dominantScene(classification.sceneTags)
  const query = [flavor, scene?.query, baseQuery].filter(Boolean).join(' ')
  return {
    lane: scene ? `${scene.label} ${classification.mood}` : base.lane,
    query
  }
}
