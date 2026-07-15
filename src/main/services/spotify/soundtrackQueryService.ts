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

export interface SoundtrackQueryPlan {
  lane: string
  query: string
  source: 'openai' | 'fallback'
}

const planCache = new Map<string, SoundtrackQueryPlan>()

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

export function fallbackSoundtrackQuery(
  classification: AmbientClassification,
  taste: readonly string[] = readGenrePreferences()
): SoundtrackQueryPlan {
  const mapped = buildSoundtrackLane(classification)
  const query = cleanPhrase([taste[0], mapped.query].filter(Boolean).join(' '), 120)
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
  const fallback = fallbackSoundtrackQuery(classification, taste)
  const key = getDecryptedOpenaiKey()
  const settings = readSettings()
  const baseUrl = getOpenaiBaseUrl()

  if (!key || settings.providerMode !== 'openai' || !isOfficialOpenAI(baseUrl)) return fallback

  const excerpt = cleanPhrase(passageExcerpt, MAX_PASSAGE_CHARS)
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
            'Return searchable style terms, not an invented song title or artist.',
            'Favor instrumental, score, ambient, acoustic, jazz, classical, or electronic music unless the passage strongly calls for something else.',
            'The query should contain 3 to 8 concrete terms covering mood, scene, instrumentation, and energy.',
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
