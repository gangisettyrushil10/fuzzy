import OpenAI from 'openai'
import type { AmbientClassification } from '@shared/types/api'
import {
  getDecryptedOpenaiKey,
  getOpenaiBaseUrl,
  readSettings
} from '../settingsService'
import { buildSoundtrackLane } from './moodMusicMap'
import { readGenrePreferences } from './spotifyTokenStore'

const OPENAI_BASE_URL = 'https://api.openai.com/v1'
const MAX_PASSAGE_CHARS = 1_600
const MAX_CACHE_ENTRIES = 64
const MAX_FALLBACK_QUERY_CHARS = 120

export interface SoundtrackQueryPlan {
  lane: string
  query: string
  source: 'openai' | 'fallback'
}

interface NarrativeCue {
  id: string
  lane: string
  queryTerms: string[]
  words: readonly string[]
}

const planCache = new Map<string, SoundtrackQueryPlan>()

const NARRATIVE_CUES: NarrativeCue[] = [
  {
    id: 'danger',
    lane: 'Quiet danger',
    queryTerms: ['low pulse', 'suspense', 'tension'],
    words: [
      'danger',
      'dangerous',
      'threat',
      'threatened',
      'warning',
      'risk',
      'trap',
      'trapped',
      'cornered'
    ]
  },
  {
    id: 'panic',
    lane: 'Panic spiral',
    queryTerms: ['anxious', 'minimal', 'tension'],
    words: [
      'panic',
      'panicked',
      'nausea',
      'nauseous',
      'spiraling',
      'breath',
      'breathing',
      'desperate',
      'dire',
      'dread'
    ]
  },
  {
    id: 'hardship',
    lane: 'Hardship pressure',
    queryTerms: ['somber', 'noir', 'pressure'],
    words: [
      'money',
      'dollars',
      'broke',
      'rent',
      'evict',
      'kicking us out',
      'streets',
      'job',
      'hire',
      'waitress',
      'debt',
      'bills',
      'apartment',
      'sell',
      'scrape together'
    ]
  },
  {
    id: 'crime',
    lane: 'Outlaw dread',
    queryTerms: ['crime', 'noir', 'suspense'],
    words: [
      'criminal',
      'crime',
      'thief',
      'steal',
      'stealing',
      'detention',
      'convicted',
      'gang',
      'bounty',
      'fugitive',
      'record',
      'ban'
    ]
  },
  {
    id: 'technology',
    lane: 'Digital tension',
    queryTerms: ['electronic', 'cyber', 'noir'],
    words: [
      'hacker',
      'hacked',
      'hack',
      'computer',
      'computers',
      'phone',
      'data',
      'identity',
      'automated',
      'screen',
      'tv',
      'glasses',
      'network',
      'code',
      'virtual',
      'robot'
    ]
  },
  {
    id: 'pursuit',
    lane: 'Pursuit',
    queryTerms: ['kinetic', 'chase', 'tension'],
    words: ['run', 'running', 'chase', 'chased', 'escape', 'flee', 'flight', 'pursue', 'pursuit']
  },
  {
    id: 'intimacy',
    lane: 'Close intimacy',
    queryTerms: ['intimate', 'soft', 'piano'],
    words: [
      'touch',
      'kiss',
      'kissed',
      'embrace',
      'whisper',
      'tender',
      'close',
      'heart',
      'love',
      'longing'
    ]
  },
  {
    id: 'grief',
    lane: 'Grief',
    queryTerms: ['melancholy', 'slow', 'piano'],
    words: ['grief', 'loss', 'lost', 'dead', 'death', 'mourning', 'funeral', 'gone', 'cry', 'tears']
  },
  {
    id: 'wonder',
    lane: 'Wonder',
    queryTerms: ['shimmering', 'ambient', 'awe'],
    words: [
      'wonder',
      'glow',
      'glowing',
      'beautiful',
      'impossible',
      'floating',
      'stars',
      'vast',
      'magical'
    ]
  }
]

function cleanPhrase(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  const withoutControls = Array.from(value, (character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127 ? ' ' : character
  }).join('')
  return withoutControls.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function isOfficialOpenAI(baseUrl: string | null): boolean {
  return (baseUrl ?? OPENAI_BASE_URL).replace(/\/+$/, '') === OPENAI_BASE_URL
}

function phraseScore(lower: string, words: readonly string[]): number {
  let score = 0
  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const phrase = /\s/.test(word)
      ? new RegExp(escaped, 'i')
      : new RegExp(`\\b${escaped}\\b`, 'i')
    if (phrase.test(lower)) score += /\s/.test(word) ? 1.8 : 1
  }
  return score
}

function uniqueTerms(terms: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const term of terms) {
    const clean = cleanPhrase(term, 32).toLowerCase()
    if (!clean || seen.has(clean)) continue
    seen.add(clean)
    out.push(clean)
  }
  return out
}

function inferNarrativeFallback(
  classification: AmbientClassification,
  passageExcerpt: string,
  taste: readonly string[]
): SoundtrackQueryPlan | null {
  const lower = passageExcerpt.toLowerCase()
  if (!lower.trim()) return null

  const ranked = NARRATIVE_CUES.map((cue) => ({ cue, score: phraseScore(lower, cue.words) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  if (ranked.length === 0) return null

  const top = ranked.slice(0, 3)
  const primary = top[0].cue
  const tone =
    classification.mood === 'sadness' || classification.mood === 'grief'
      ? 'melancholy'
      : classification.mood === 'fear'
        ? 'dark'
        : classification.mood === 'anger'
          ? 'intense'
          : classification.mood === 'love'
            ? 'intimate'
            : classification.mood === 'tension' || classification.intensity > 0.55
              ? 'tense'
              : 'moody'

  const medium =
    top.some((entry) => entry.cue.id === 'technology') || classification.genre === 'sci-fi'
      ? ['electronic', 'synth']
      : ['instrumental']

  const query = cleanPhrase(
    uniqueTerms([
      taste[0] ?? '',
      tone,
      ...medium,
      ...top.flatMap((entry) => entry.cue.queryTerms),
      'score'
    ]).join(' '),
    MAX_FALLBACK_QUERY_CHARS
  )

  return {
    lane: primary.lane,
    query,
    source: 'fallback'
  }
}

export function fallbackSoundtrackQuery(
  classification: AmbientClassification,
  taste: readonly string[] = readGenrePreferences(),
  passageExcerpt = ''
): SoundtrackQueryPlan {
  const narrative = inferNarrativeFallback(classification, passageExcerpt, taste)
  if (narrative) return narrative

  const mapped = buildSoundtrackLane(classification)
  const query = cleanPhrase(
    [taste[0], mapped.query].filter(Boolean).join(' '),
    MAX_FALLBACK_QUERY_CHARS
  )
  return { lane: mapped.lane, query, source: 'fallback' }
}

function parsePlan(output: string, fallback: SoundtrackQueryPlan): SoundtrackQueryPlan {
  try {
    const parsed = JSON.parse(output) as { lane?: unknown; query?: unknown }
    const lane = cleanPhrase(parsed.lane, 48)
    const query = cleanPhrase(parsed.query, 120)
    if (!lane || query.length < 3 || /\bplaylist\b/i.test(query)) return fallback
    return { lane, query, source: 'openai' }
  } catch {
    return fallback
  }
}

function cachePlan(key: string, plan: SoundtrackQueryPlan): void {
  if (planCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = planCache.keys().next().value
    if (oldest) planCache.delete(oldest)
  }
  planCache.set(key, plan)
}

export async function planSoundtrackQuery(
  classification: AmbientClassification,
  passageExcerpt = ''
): Promise<SoundtrackQueryPlan> {
  const taste = readGenrePreferences()
  const excerpt = cleanPhrase(passageExcerpt, MAX_PASSAGE_CHARS)
  const fallback = fallbackSoundtrackQuery(classification, taste, excerpt)
  const key = getDecryptedOpenaiKey()
  const settings = readSettings()
  const baseUrl = getOpenaiBaseUrl()

  if (!key || settings.providerMode !== 'openai' || !isOfficialOpenAI(baseUrl)) return fallback

  const cacheKey = JSON.stringify({ classification, taste, excerpt, model: settings.openaiModel })
  const cached = planCache.get(cacheKey)
  if (cached) return cached

  const client = new OpenAI({ apiKey: key, baseURL: baseUrl ?? undefined, timeout: 7_000 })
  try {
    const response = await client.responses.create({
      model: settings.openaiModel,
      input: [
        {
          role: 'system',
          content: [
            'Plan a Spotify catalog TRACK search that can unobtrusively soundtrack a reading passage.',
            'Use ONLY the visible passage text in passageExcerpt as scene evidence; ignore chapter titles, book-level genre, and opening-credit framing unless the visible words themselves support it.',
            'Return searchable style terms, not an invented song title or artist.',
            'Prefer the passage’s immediate emotional stakes and concrete situation over broad genre labels.',
            'Favor instrumental, score, ambient, acoustic, jazz, classical, or electronic music unless the passage strongly calls for something else.',
            'The query should contain 3 to 8 concrete terms covering mood, scene, instrumentation, and energy.',
            'Avoid fantasy/dream/sleep terms for ordinary realism, hardship, crime, technology, grief, panic, or domestic tension unless those words are actually present.',
            'Never request a playlist and never include the word playlist.'
          ].join(' ')
        },
        {
          role: 'user',
          content: JSON.stringify({ classification, passageExcerpt: excerpt, taste })
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'soundtrack_query',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              lane: { type: 'string', minLength: 2, maxLength: 48 },
              query: { type: 'string', minLength: 3, maxLength: 120 }
            },
            required: ['lane', 'query'],
            additionalProperties: false
          }
        }
      },
      max_output_tokens: 180
    })
    const plan = parsePlan(response.output_text, fallback)
    cachePlan(cacheKey, plan)
    return plan
  } catch (err) {
    console.warn('[fuzzy spotify] AI soundtrack planning failed; using local mapping', err)
    return fallback
  }
}

export function clearSoundtrackQueryCache(): void {
  planCache.clear()
}
