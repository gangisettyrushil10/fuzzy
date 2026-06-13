import OpenAI from 'openai'
import { getDecryptedOpenaiKey, getOpenaiBaseUrl, readSettings } from '../settingsService'
import type {
  AmbientClassification,
  AmbientContentType,
  AmbientGenre,
  AmbientMood,
  AmbientMotion
} from '@shared/types/api'

const CLASSIFY_TIMEOUT_MS = 12_000
const CLASSIFY_MAX_TOKENS = 180
const INPUT_CHAR_LIMIT = 1200

const VALID_MOODS = new Set<string>([
  'love',
  'sadness',
  'joy',
  'mystery',
  'tension',
  'calm',
  'awe',
  'fear',
  'anger',
  'grief',
  'hope',
  'wonder',
  'nostalgia',
  'neutral'
])
const VALID_GENRES = new Set<string>([
  'fantasy',
  'mystery',
  'thriller',
  'romance',
  'sci-fi',
  'adventure',
  'literary',
  'academic',
  'unknown'
])
const VALID_TYPES = new Set<string>(['fiction', 'non-fiction'])
const VALID_MOTIONS = new Set<string>([
  'still',
  'drift',
  'wave',
  'mist',
  'pulse',
  'shimmer',
  'embers'
])

const FALLBACK: AmbientClassification = {
  mood: 'neutral',
  secondaryMood: null,
  genre: 'literary',
  type: 'fiction',
  intensity: 0.12,
  sceneTags: [],
  paletteHints: ['slate', 'indigo'],
  motion: 'drift'
}

const cache = new Map<string, AmbientClassification>()

const MOOD_LEXICON: Record<AmbientMood, readonly string[]> = {
  love: [
    'love',
    'loved',
    'loving',
    'kiss',
    'kissed',
    'desire',
    'desperate',
    'tender',
    'romance',
    'romantic',
    'warmth',
    'caress',
    'heart',
    'heartbeat',
    'yearning',
    'longing',
    'beloved',
    'embrace'
  ],
  sadness: [
    'sad',
    'sadness',
    'weep',
    'wept',
    'cry',
    'cried',
    'lonely',
    'rain',
    'rainy',
    'tears',
    'empty',
    'hollow',
    'blue',
    'sorrow',
    'aching',
    'miserable',
    'hurt'
  ],
  joy: [
    'joy',
    'laugh',
    'laughed',
    'smile',
    'smiled',
    'sunlit',
    'celebrate',
    'bright',
    'glee',
    'happy',
    'happiness',
    'delight',
    'dance',
    'sparkle'
  ],
  mystery: [
    'secret',
    'shadow',
    'whisper',
    'unknown',
    'curious',
    'curiosity',
    'strange',
    'hidden',
    'veil',
    'cryptic',
    'echo',
    'midnight',
    'clue'
  ],
  tension: [
    'tense',
    'tension',
    'edge',
    'tight',
    'nervous',
    'warning',
    'dangerous',
    'alarm',
    'breathless',
    'pressure',
    'strained',
    'uncertain'
  ],
  calm: [
    'calm',
    'quiet',
    'still',
    'soft',
    'gentle',
    'breeze',
    'peace',
    'rest',
    'tranquil',
    'serene',
    'hush',
    'meadow',
    'settled'
  ],
  awe: [
    'vast',
    'immense',
    'glory',
    'radiant',
    'sublime',
    'heavens',
    'starlit',
    'towering',
    'legend',
    'divine',
    'epic',
    'majestic'
  ],
  fear: [
    'fear',
    'afraid',
    'frightened',
    'terror',
    'dread',
    'panic',
    'nightmare',
    'horror',
    'shiver',
    'haunted',
    'ominous',
    'tremble'
  ],
  anger: [
    'anger',
    'angry',
    'rage',
    'fury',
    'furious',
    'snarl',
    'burning',
    'resentment',
    'spat',
    'shouted',
    'yelled',
    'violent'
  ],
  grief: [
    'grief',
    'grieving',
    'mourning',
    'loss',
    'lost',
    'funeral',
    'grave',
    'goodbye',
    'gone',
    'broken',
    'devastated',
    'bereft'
  ],
  hope: [
    'hope',
    'hopeful',
    'promise',
    'promised',
    'dawn',
    'tomorrow',
    'rise',
    'beginning',
    'renewed',
    'chance',
    'faith'
  ],
  wonder: [
    'wonder',
    'magic',
    'magical',
    'enchanted',
    'miracle',
    'glimmer',
    'golden',
    'curved',
    'floating',
    'spell',
    'shining',
    'marvel'
  ],
  nostalgia: [
    'memory',
    'remembered',
    'remember',
    'childhood',
    'once',
    'used to',
    'old',
    'familiar',
    'faded',
    'photograph',
    'summer',
    'back then'
  ],
  neutral: []
}

const SCENE_LEXICON: Record<string, readonly string[]> = {
  rain: ['rain', 'rainy', 'drizzle', 'stormwater', 'downpour', 'wet', 'thunderstorm'],
  ocean: ['ocean', 'sea', 'waves', 'wave', 'salt', 'shore', 'tide', 'pirate', 'ship', 'harbor'],
  river: ['river', 'stream', 'brook', 'current', 'waterfall'],
  forest: ['forest', 'woods', 'tree', 'trees', 'pine', 'moss', 'leaf', 'grove'],
  garden: ['garden', 'flowers', 'flower', 'petals', 'rose', 'bloom', 'greenhouse'],
  castle: ['castle', 'stone', 'turret', 'tower', 'corridor', 'hall', 'fortress'],
  city: ['city', 'street', 'traffic', 'alley', 'neon', 'apartment', 'subway'],
  night: ['night', 'moon', 'midnight', 'dark', 'stars', 'starlight', 'twilight'],
  snow: ['snow', 'winter', 'ice', 'frost', 'blizzard'],
  fire: ['fire', 'flame', 'ember', 'torch', 'blaze', 'burning', 'smoke'],
  magic: ['magic', 'spell', 'wand', 'enchanted', 'wizard', 'sorcerer', 'glow'],
  gold: ['gold', 'treasure', 'crown', 'coin', 'sunlit', 'jewel', 'amber'],
  storm: ['storm', 'lightning', 'thunder', 'tempest', 'gale'],
  battle: ['battle', 'war', 'sword', 'army', 'fight', 'duel', 'attack'],
  blood: ['blood', 'bloody', 'wound', 'scarlet', 'crimson'],
  dawn: ['dawn', 'sunrise', 'morning', 'daybreak'],
  dusk: ['dusk', 'sunset', 'evening', 'violet sky'],
  fog: ['fog', 'mist', 'haze', 'smoke', 'shrouded']
}

const GENRE_HINTS: Record<AmbientGenre, readonly string[]> = {
  fantasy: ['magic', 'spell', 'dragon', 'castle', 'sword', 'enchanted', 'wizard'],
  mystery: ['murder', 'detective', 'clue', 'secret', 'crime', 'investigation'],
  thriller: ['gun', 'blood', 'chase', 'killer', 'explosion', 'hostage'],
  romance: ['kiss', 'desire', 'lover', 'love', 'embrace', 'heart'],
  'sci-fi': ['spaceship', 'galaxy', 'android', 'orbit', 'laser', 'alien'],
  adventure: ['journey', 'ship', 'quest', 'pirate', 'map', 'expedition'],
  literary: ['memory', 'silence', 'room', 'quiet', 'voice', 'window'],
  academic: ['study', 'theory', 'evidence', 'analysis', 'research', 'chapter'],
  unknown: []
}

const PALETTE_BY_MOOD: Record<AmbientMood, string[]> = {
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

const PALETTE_BY_SCENE: Record<string, string[]> = {
  rain: ['blue', 'slate', 'silver'],
  ocean: ['blue', 'teal', 'cyan'],
  river: ['teal', 'blue', 'glass'],
  forest: ['green', 'moss', 'sage'],
  garden: ['rose', 'green', 'pearl'],
  castle: ['stone', 'slate', 'silver'],
  city: ['steel', 'indigo', 'neon'],
  night: ['midnight', 'violet', 'silver'],
  snow: ['ice', 'silver', 'blue'],
  fire: ['ember', 'orange', 'gold'],
  magic: ['violet', 'cyan', 'gold'],
  gold: ['gold', 'amber', 'honey'],
  storm: ['indigo', 'slate', 'electric'],
  battle: ['scarlet', 'iron', 'smoke'],
  blood: ['crimson', 'blackberry', 'ash'],
  dawn: ['peach', 'gold', 'sky'],
  dusk: ['violet', 'rose', 'amber'],
  fog: ['silver', 'pearl', 'slate']
}

const PALETTE_BY_FAMILY: Record<string, string[]> = {
  oceanic: ['blue', 'teal', 'cyan'],
  storm: ['indigo', 'slate', 'electric'],
  magic: ['violet', 'cyan', 'gold'],
  ember: ['ember', 'orange', 'gold'],
  blood: ['crimson', 'blackberry', 'ash'],
  stone: ['stone', 'slate', 'silver'],
  woodland: ['green', 'moss', 'sage'],
  nocturne: ['midnight', 'violet', 'silver'],
  dawn: ['peach', 'gold', 'sky'],
  treasure: ['gold', 'amber', 'honey'],
  city: ['steel', 'indigo', 'neon']
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function excerptKey(documentId: string, pageNumber: number, text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  }
  return `${documentId}:${pageNumber}:${hash.toString(36)}`
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function countMatches(haystack: string, needles: readonly string[]): number {
  let score = 0
  for (const needle of needles) {
    if (!needle) continue
    if (needle.includes(' ')) {
      if (haystack.includes(needle)) score += 2
    } else {
      const regex = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
      score += haystack.match(regex)?.length ?? 0
    }
  }
  return score
}

function pickTop<T extends string>(scores: Record<T, number>, fallback: T): T {
  let winner = fallback
  let best = -Infinity
  for (const [key, score] of Object.entries(scores) as Array<[T, number]>) {
    if (score > best) {
      best = score
      winner = key
    }
  }
  return winner
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

function dominantSceneFamily(sceneTags: string[]): string | null {
  if (sceneTags.includes('storm')) return 'storm'
  if (sceneTags.includes('magic')) return 'magic'
  if (sceneTags.includes('ocean') || sceneTags.includes('river') || sceneTags.includes('rain')) {
    return 'oceanic'
  }
  if (sceneTags.includes('fire') || sceneTags.includes('battle')) return 'ember'
  if (sceneTags.includes('blood')) return 'blood'
  if (sceneTags.includes('castle')) return 'stone'
  if (sceneTags.includes('forest') || sceneTags.includes('garden')) return 'woodland'
  if (sceneTags.includes('night') || sceneTags.includes('fog') || sceneTags.includes('snow')) {
    return 'nocturne'
  }
  if (sceneTags.includes('dawn') || sceneTags.includes('dusk')) return 'dawn'
  if (sceneTags.includes('gold')) return 'treasure'
  if (sceneTags.includes('city')) return 'city'
  return null
}

function inferMotion(sceneTags: string[], mood: AmbientMood, intensity: number): AmbientMotion {
  if (sceneTags.includes('ocean') || sceneTags.includes('river') || sceneTags.includes('rain')) {
    return 'wave'
  }
  if (sceneTags.includes('fog')) return 'mist'
  if (sceneTags.includes('fire') || sceneTags.includes('battle') || mood === 'anger') {
    return intensity > 0.58 ? 'embers' : 'pulse'
  }
  if (sceneTags.includes('magic') || mood === 'wonder' || mood === 'awe') return 'shimmer'
  if (mood === 'tension' || mood === 'fear') return 'pulse'
  if (intensity < 0.18) return 'still'
  return 'drift'
}

function inferType(excerpt: string): AmbientContentType {
  const lower = excerpt.toLowerCase()
  const nonfictionMarkers = [
    'according to',
    'for example',
    'in conclusion',
    'research',
    'evidence',
    'study',
    'therefore',
    'chapter',
    'figure',
    'analysis'
  ]
  return nonfictionMarkers.some((marker) => lower.includes(marker)) ? 'non-fiction' : 'fiction'
}

function classifyLocally(excerpt: string): AmbientClassification {
  const lower = excerpt.toLowerCase()
  const tokens = tokenize(excerpt)
  const tokenText = ` ${tokens.join(' ')} `

  const moodScores = Object.fromEntries(
    (Object.keys(MOOD_LEXICON) as AmbientMood[]).map((mood) => [
      mood,
      countMatches(tokenText, MOOD_LEXICON[mood])
    ])
  ) as Record<AmbientMood, number>

  const sceneScores = Object.fromEntries(
    Object.entries(SCENE_LEXICON).map(([tag, words]) => [tag, countMatches(tokenText, words)])
  ) as Record<string, number>

  const genreScores = Object.fromEntries(
    (Object.keys(GENRE_HINTS) as AmbientGenre[]).map((genre) => [
      genre,
      countMatches(tokenText, GENRE_HINTS[genre])
    ])
  ) as Record<AmbientGenre, number>

  if (sceneScores.rain > 0) moodScores.sadness += 1.2
  if (sceneScores.ocean > 0) moodScores.awe += 0.8
  if (sceneScores.magic > 0) moodScores.wonder += 1.4
  if (sceneScores.castle > 0) moodScores.mystery += 0.8
  if (sceneScores.gold > 0) moodScores.joy += 0.5
  if (sceneScores.storm > 0 || sceneScores.battle > 0) moodScores.tension += 1.2
  if (sceneScores.blood > 0) moodScores.anger += 0.9
  if (sceneScores.fog > 0 || sceneScores.night > 0) moodScores.fear += 0.7
  if (sceneScores.forest > 0 || sceneScores.garden > 0) moodScores.calm += 0.7
  if (sceneScores.dawn > 0) moodScores.hope += 0.8
  if (sceneScores.dusk > 0) moodScores.nostalgia += 0.7

  const mood = pickTop(moodScores, 'neutral')
  const secondaryMood = (Object.entries(moodScores) as Array<[AmbientMood, number]>)
    .filter(([key]) => key !== mood)
    .sort((a, b) => b[1] - a[1])[0]?.[1]
    ? (Object.entries(moodScores) as Array<[AmbientMood, number]>)
        .filter(([key]) => key !== mood)
        .sort((a, b) => b[1] - a[1])[0][0]
    : null

  const sceneTags = Object.entries(sceneScores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag]) => tag)

  const genre = pickTop(genreScores, sceneTags.includes('magic') ? 'fantasy' : 'literary')
  const type = inferType(excerpt)

  const dramaticWords = countMatches(lower, [
    '!',
    '?',
    'suddenly',
    'never',
    'always',
    'shouted',
    'screamed',
    'whispered'
  ])
  const totalScore =
    Object.values(moodScores).reduce((sum, value) => sum + value, 0) +
    Object.values(sceneScores).reduce((sum, value) => sum + value * 0.5, 0) +
    dramaticWords * 0.2
  const intensity = clamp01(0.18 + Math.min(0.82, totalScore / 18))
  const family = dominantSceneFamily(sceneTags)
  const familyPalette = family ? (PALETTE_BY_FAMILY[family] ?? []) : []
  const primaryScenePalette = sceneTags[0] ? (PALETTE_BY_SCENE[sceneTags[0]] ?? []) : []
  const paletteHints = unique([
    ...familyPalette,
    ...primaryScenePalette,
    ...(PALETTE_BY_MOOD[mood] ?? []),
    ...(secondaryMood ? (PALETTE_BY_MOOD[secondaryMood] ?? []) : [])
  ]).slice(0, 5)

  return {
    mood,
    secondaryMood,
    genre,
    type,
    intensity,
    sceneTags,
    paletteHints: paletteHints.length > 0 ? paletteHints : FALLBACK.paletteHints,
    motion: inferMotion(sceneTags, mood, intensity)
  }
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 6)
}

function parseClassification(raw: string): AmbientClassification | null {
  try {
    const cleaned = raw.replace(/```[a-z]*\n?/gi, '').trim()
    const obj = JSON.parse(cleaned) as Record<string, unknown>
    const mood = VALID_MOODS.has(String(obj.mood)) ? (obj.mood as AmbientMood) : null
    if (!mood) return null

    const secondaryCandidate = String(obj.secondaryMood ?? '')
    const secondaryMood =
      VALID_MOODS.has(secondaryCandidate) && secondaryCandidate !== mood
        ? (secondaryCandidate as AmbientMood)
        : null

    const genre = VALID_GENRES.has(String(obj.genre)) ? (obj.genre as AmbientGenre) : 'unknown'
    const type = VALID_TYPES.has(String(obj.type)) ? (obj.type as AmbientContentType) : 'fiction'
    const intensity = clamp01(Number(obj.intensity))
    const sceneTags = parseStringArray(obj.sceneTags)
    const paletteHints = parseStringArray(obj.paletteHints)
    const motion = VALID_MOTIONS.has(String(obj.motion))
      ? (obj.motion as AmbientMotion)
      : inferMotion(sceneTags, mood, intensity)

    return {
      mood,
      secondaryMood,
      genre,
      type,
      intensity,
      sceneTags,
      paletteHints,
      motion
    }
  } catch {
    return null
  }
}

function mergeClassification(
  local: AmbientClassification,
  remote: AmbientClassification | null
): AmbientClassification {
  if (!remote) return local
  return {
    mood: remote.mood ?? local.mood,
    secondaryMood: remote.secondaryMood ?? local.secondaryMood,
    genre: remote.genre === 'unknown' ? local.genre : remote.genre,
    type: remote.type ?? local.type,
    intensity: clamp01(local.intensity * 0.45 + remote.intensity * 0.55),
    sceneTags: unique([...remote.sceneTags, ...local.sceneTags]).slice(0, 6),
    paletteHints: unique([...remote.paletteHints, ...local.paletteHints]).slice(0, 6),
    motion: remote.motion ?? local.motion
  }
}

export async function classifyPage(
  documentId: string,
  pageNumber: number,
  text: string
): Promise<AmbientClassification> {
  const excerpt = text.slice(0, INPUT_CHAR_LIMIT).trim()
  if (!excerpt) return FALLBACK

  const cacheKey = excerptKey(documentId, pageNumber, excerpt)
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const local = classifyLocally(excerpt)
  const key = getDecryptedOpenaiKey()
  if (!key) {
    cache.set(cacheKey, local)
    return local
  }

  const client = new OpenAI({
    apiKey: key,
    timeout: CLASSIFY_TIMEOUT_MS,
    baseURL: getOpenaiBaseUrl() ?? undefined
  })

  const system = [
    'Classify the atmosphere of this passage for a cinematic reading UI.',
    'Return ONLY JSON with these fields:',
    'mood, secondaryMood, genre, type, intensity, sceneTags, paletteHints, motion.',
    'Mood must be one of: love sadness joy mystery tension calm awe fear anger grief hope wonder nostalgia neutral.',
    'Genre must be one of: fantasy mystery thriller romance sci-fi adventure literary academic unknown.',
    'Type must be fiction or non-fiction.',
    'Motion must be one of: still drift wave mist pulse shimmer embers.',
    'sceneTags should be concrete scene words like rain ocean forest castle city night snow fire magic gold storm battle blood dawn dusk fog.',
    'paletteHints should be evocative color/material words like blue silver gold violet slate emerald crimson amber teal.',
    'Use a wide, nuanced interpretation of the scene and emotional mix.'
  ].join(' ')

  try {
    const completion = await client.chat.completions.create({
      model: readSettings().openaiModel,
      temperature: 0.2,
      max_completion_tokens: CLASSIFY_MAX_TOKENS,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Passage:\n\n${excerpt}` }
      ]
    })
    const content = completion.choices?.[0]?.message?.content?.trim() ?? ''
    const merged = mergeClassification(local, parseClassification(content))
    cache.set(cacheKey, merged)
    return merged
  } catch (err) {
    console.warn('[fuzzy ambient] classification failed; using local fallback', err)
    cache.set(cacheKey, local)
    return local
  }
}

export function clearAmbientCache(): void {
  cache.clear()
}
