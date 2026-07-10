import type {
  AmbientClassification,
  AmbientContentType,
  AmbientGenre,
  AmbientMood,
  AmbientMotion
} from '@shared/types/api'

const MOOD_HINTS: Record<AmbientMood, readonly string[]> = {
  love: ['love', 'kiss', 'tender', 'heart', 'longing', 'beloved', 'embrace'],
  sadness: ['sad', 'weep', 'cry', 'lonely', 'rain', 'tears', 'sorrow', 'empty'],
  joy: ['joy', 'laugh', 'smile', 'bright', 'happy', 'delight', 'sparkle'],
  mystery: ['secret', 'shadow', 'whisper', 'unknown', 'strange', 'hidden', 'midnight'],
  tension: ['tense', 'danger', 'alarm', 'breathless', 'pressure', 'warning', 'uncertain'],
  calm: ['calm', 'quiet', 'soft', 'gentle', 'peace', 'tranquil', 'hush', 'settled'],
  awe: ['vast', 'radiant', 'sublime', 'starlit', 'towering', 'majestic'],
  fear: ['fear', 'afraid', 'dread', 'panic', 'haunted', 'ominous', 'tremble'],
  anger: ['anger', 'rage', 'fury', 'burning', 'shouted', 'violent'],
  grief: ['grief', 'mourning', 'loss', 'grave', 'goodbye', 'broken'],
  hope: ['hope', 'dawn', 'tomorrow', 'renewed', 'chance', 'faith'],
  wonder: ['wonder', 'magic', 'enchanted', 'glimmer', 'spell', 'shining'],
  nostalgia: ['memory', 'remember', 'childhood', 'old', 'familiar', 'faded', 'summer'],
  neutral: []
}

const SCENE_HINTS: Record<
  string,
  {
    words: readonly string[]
    palette: readonly string[]
    boost?: AmbientMood
    genre?: AmbientGenre
  }
> = {
  ocean: {
    words: ['ocean', 'sea', 'waves', 'shore', 'tide', 'ship', 'harbor'],
    palette: ['blue', 'teal', 'cyan'],
    boost: 'awe',
    genre: 'adventure'
  },
  forest: {
    words: ['forest', 'woods', 'tree', 'moss', 'leaf', 'grove'],
    palette: ['green', 'moss', 'sage'],
    boost: 'calm'
  },
  night: {
    words: ['night', 'moon', 'midnight', 'dark', 'stars', 'twilight'],
    palette: ['midnight', 'violet', 'silver'],
    boost: 'mystery'
  },
  fire: {
    words: ['fire', 'flame', 'ember', 'torch', 'blaze', 'smoke'],
    palette: ['ember', 'orange', 'gold'],
    boost: 'tension'
  },
  magic: {
    words: ['magic', 'spell', 'enchanted', 'wizard', 'glow', 'miracle'],
    palette: ['violet', 'cyan', 'gold'],
    boost: 'wonder',
    genre: 'fantasy'
  },
  storm: {
    words: ['storm', 'lightning', 'thunder', 'tempest', 'gale'],
    palette: ['indigo', 'slate', 'electric'],
    boost: 'tension'
  },
  dawn: {
    words: ['dawn', 'sunrise', 'morning', 'daybreak'],
    palette: ['peach', 'gold', 'sky'],
    boost: 'hope'
  },
  city: {
    words: ['city', 'street', 'traffic', 'alley', 'neon', 'subway'],
    palette: ['steel', 'indigo', 'neon'],
    boost: 'mystery'
  },
  gold: {
    words: ['gold', 'treasure', 'crown', 'coin', 'jewel', 'amber'],
    palette: ['gold', 'amber', 'honey'],
    boost: 'joy',
    genre: 'adventure'
  },
  fog: {
    words: ['fog', 'mist', 'haze', 'shrouded'],
    palette: ['silver', 'pearl', 'slate'],
    boost: 'mystery'
  }
}

const PALETTE_BY_MOOD: Record<AmbientMood, readonly string[]> = {
  love: ['rose', 'crimson', 'blush'],
  sadness: ['blue', 'indigo', 'slate'],
  joy: ['gold', 'amber', 'sunrise'],
  mystery: ['violet', 'indigo', 'midnight'],
  tension: ['red', 'copper', 'smoke'],
  calm: ['teal', 'seafoam', 'sage'],
  awe: ['azure', 'violet', 'silver'],
  fear: ['purple', 'charcoal', 'ink'],
  anger: ['scarlet', 'ember', 'maroon'],
  grief: ['slate', 'steel', 'ash'],
  hope: ['gold', 'sky', 'mint'],
  wonder: ['violet', 'gold', 'cyan'],
  nostalgia: ['sepia', 'honey', 'dusty-rose'],
  neutral: ['slate', 'indigo']
}

function tokenize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9\s'-]+/g, ' ')} `
}

function countHints(haystack: string, hints: readonly string[]): number {
  let count = 0
  for (const hint of hints) {
    const escaped = hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    count += haystack.match(new RegExp(`\\b${escaped}\\b`, 'g'))?.length ?? 0
  }
  return count
}

function bestEntry<T extends string>(scores: Record<T, number>, fallback: T): [T, number] {
  return (Object.entries(scores) as Array<[T, number]>).reduce<[T, number]>(
    (best, entry) => (entry[1] > best[1] ? entry : best),
    [fallback, -Infinity]
  )
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].filter(Boolean)
}

function inferType(text: string): AmbientContentType {
  const lower = text.toLowerCase()
  return ['research', 'evidence', 'analysis', 'therefore', 'figure', 'according to'].some(
    (marker) => lower.includes(marker)
  )
    ? 'non-fiction'
    : 'fiction'
}

function inferMotion(sceneTags: string[], mood: AmbientMood, intensity: number): AmbientMotion {
  if (sceneTags.some((tag) => tag === 'ocean')) return 'wave'
  if (sceneTags.some((tag) => tag === 'fog')) return 'mist'
  if (sceneTags.some((tag) => tag === 'fire') || mood === 'anger') return 'embers'
  if (sceneTags.some((tag) => tag === 'magic') || mood === 'wonder' || mood === 'awe') {
    return 'shimmer'
  }
  if (mood === 'tension' || mood === 'fear') return 'pulse'
  if (intensity < 0.18) return 'still'
  return 'drift'
}

export function previewAmbientClassification(text: string): AmbientClassification {
  const haystack = tokenize(text)
  const moodScores = Object.fromEntries(
    (Object.keys(MOOD_HINTS) as AmbientMood[]).map((mood) => [
      mood,
      countHints(haystack, MOOD_HINTS[mood])
    ])
  ) as Record<AmbientMood, number>

  const sceneScores = Object.fromEntries(
    Object.entries(SCENE_HINTS).map(([scene, config]) => [
      scene,
      countHints(haystack, config.words)
    ])
  ) as Record<string, number>

  for (const [scene, score] of Object.entries(sceneScores)) {
    const boost = SCENE_HINTS[scene]?.boost
    if (boost && score > 0) moodScores[boost] += 0.8 + score * 0.4
  }

  const [mood, moodScore] = bestEntry(moodScores, 'neutral')
  const secondaryMood =
    (Object.entries(moodScores) as Array<[AmbientMood, number]>)
      .filter(([candidate, score]) => candidate !== mood && score > 0)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const sceneTags = Object.entries(sceneScores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([scene]) => scene)
  const scenePalette = sceneTags.flatMap((scene) => SCENE_HINTS[scene]?.palette ?? [])
  const genre = sceneTags.map((scene) => SCENE_HINTS[scene]?.genre).find(Boolean) ?? 'literary'
  const sceneScore = Object.values(sceneScores).reduce((sum, score) => sum + score, 0)
  const intensity = Math.max(0.14, Math.min(0.72, 0.18 + moodScore * 0.08 + sceneScore * 0.06))

  return {
    mood: moodScore > 0 ? mood : 'neutral',
    secondaryMood,
    genre,
    type: inferType(text),
    intensity,
    sceneTags,
    paletteHints: unique([
      ...scenePalette,
      ...(PALETTE_BY_MOOD[moodScore > 0 ? mood : 'neutral'] ?? []),
      ...(secondaryMood ? (PALETTE_BY_MOOD[secondaryMood] ?? []) : [])
    ]).slice(0, 5),
    motion: inferMotion(sceneTags, moodScore > 0 ? mood : 'neutral', intensity)
  }
}
