import OpenAI from 'openai'
import { getDecryptedOpenaiKey, getOpenaiBaseUrl, readSettings } from '../settingsService'
import type { AmbientClassification, AmbientMood, AmbientGenre, AmbientContentType } from '@shared/types/api'

const CLASSIFY_TIMEOUT_MS = 12_000
const CLASSIFY_MAX_TOKENS = 80
const INPUT_CHAR_LIMIT = 600

const VALID_MOODS = new Set<string>(['love', 'sadness', 'joy', 'mystery', 'tension', 'calm', 'awe', 'neutral'])
const VALID_GENRES = new Set<string>(['fantasy', 'mystery', 'thriller', 'romance', 'sci-fi', 'adventure', 'literary', 'academic', 'unknown'])
const VALID_TYPES = new Set<string>(['fiction', 'non-fiction'])

const FALLBACK: AmbientClassification = {
  mood: 'neutral',
  genre: 'unknown',
  type: 'fiction',
  intensity: 0
}

const cache = new Map<string, AmbientClassification>()

function parseClassification(raw: string): AmbientClassification | null {
  try {
    // Strip markdown code fences if the model wrapped the JSON
    const cleaned = raw.replace(/```[a-z]*\n?/g, '').trim()
    const obj = JSON.parse(cleaned) as Record<string, unknown>
    const mood = VALID_MOODS.has(String(obj.mood)) ? (obj.mood as AmbientMood) : 'neutral'
    const genre = VALID_GENRES.has(String(obj.genre)) ? (obj.genre as AmbientGenre) : 'unknown'
    const type = VALID_TYPES.has(String(obj.type)) ? (obj.type as AmbientContentType) : 'fiction'
    const raw_intensity = Number(obj.intensity)
    const intensity = isNaN(raw_intensity) ? 0 : Math.min(1, Math.max(0, raw_intensity))
    return { mood, genre, type, intensity }
  } catch {
    return null
  }
}

export async function classifyPage(
  documentId: string,
  pageNumber: number,
  text: string
): Promise<AmbientClassification | null> {
  const key = getDecryptedOpenaiKey()
  if (!key) return null

  const cacheKey = `${documentId}:${pageNumber}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const excerpt = text.slice(0, INPUT_CHAR_LIMIT).trim()
  if (!excerpt) return null

  const client = new OpenAI({
    apiKey: key,
    timeout: CLASSIFY_TIMEOUT_MS,
    baseURL: getOpenaiBaseUrl() ?? undefined
  })

  const system = [
    'Classify the emotional tone and genre of this passage.',
    'Respond with ONLY valid JSON, no explanation, no markdown.',
    'Fields: mood (one of: love sadness joy mystery tension calm awe neutral),',
    'genre (one of: fantasy mystery thriller romance sci-fi adventure literary academic unknown),',
    'type (one of: fiction non-fiction),',
    'intensity (0.0 to 1.0, how emotionally intense this passage is).'
  ].join(' ')

  try {
    const completion = await client.chat.completions.create({
      model: readSettings().openaiModel,
      temperature: 0.1,
      max_completion_tokens: CLASSIFY_MAX_TOKENS,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Passage:\n\n${excerpt}` }
      ]
    })
    const content = completion.choices?.[0]?.message?.content?.trim() ?? ''
    const result = parseClassification(content) ?? FALLBACK
    cache.set(cacheKey, result)
    return result
  } catch (err) {
    console.warn('[fuzzy ambient] classification failed', err)
    return null
  }
}

export function clearAmbientCache(): void {
  cache.clear()
}
