import type {
  AmbientClassification,
  SpotifyPlaybackResult,
  SpotifyPlaybackSnapshot,
  SpotifyRestoreResult,
  SpotifySuggestion,
  SpotifySuggestionOptions
} from '@shared/types/api'
import { getValidAccessToken } from './spotifyAuthFlow'
import { playSpotifyDesktopTrack, restoreSpotifyDesktopTrack } from './spotifyDesktopPlayer'
import { planSoundtrackQuery } from './soundtrackQueryService'
import type { SoundtrackQueryPlan } from './soundtrackTypes'

const REQUEST_TIMEOUT_MS = 8_000
const SEARCH_RESULT_LIMIT = '30'
const READING_FRIENDLY_TERMS = [
  'instrumental',
  'score',
  'soundtrack',
  'ambient',
  'cinematic',
  'lofi',
  'lo-fi',
  'downtempo',
  'piano',
  'strings',
  'orchestral',
  'electronic',
  'synth',
  'focus',
  'beats'
]
const READING_HOSTILE_TERMS = [
  'party',
  'rave',
  'club',
  'workout',
  'dancefloor',
  'festival',
  'sleep',
  'lullaby',
  'baby',
  'dreamland',
  'karaoke',
  'remix'
]

interface SpotifyImage {
  url: string
}

interface SpotifyArtist {
  name: string
}

interface SpotifyTrackItem {
  id: string
  name: string
  uri: string
  artists: SpotifyArtist[]
  album: { name: string; images: SpotifyImage[] | null }
  external_urls: { spotify?: string }
}

interface SearchResponse {
  tracks?: { items: Array<SpotifyTrackItem | null> }
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function scoreTrack(item: SpotifyTrackItem, query: string, index: number): number {
  const haystack = normalize(
    [item.name, item.album.name, item.artists.map((artist) => artist.name).join(' ')].join(' ')
  )
  const qTerms = normalize(query)
    .split(' ')
    .filter((term) => term.length >= 4)
  let score = 0
  for (const term of qTerms) {
    if (haystack.includes(term)) score += 1.4
  }
  for (const term of READING_FRIENDLY_TERMS) {
    if (haystack.includes(term)) score += 2
  }
  for (const term of READING_HOSTILE_TERMS) {
    if (haystack.includes(term)) score -= 4
  }
  if (/feat|ft\./i.test(item.name)) score -= 0.8
  return score - index * 0.05
}

async function spotifyFetch(token: string, path: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function searchTrack(
  query: string,
  excludedUris: readonly string[] = []
): Promise<SpotifySuggestion | null> {
  const token = await getValidAccessToken()
  if (!token) return null

  const params = new URLSearchParams({ q: query, type: 'track', limit: SEARCH_RESULT_LIMIT })
  try {
    const res = await spotifyFetch(token, `/search?${params.toString()}`)
    if (!res.ok) {
      console.warn('[fuzzy spotify] search failed', res.status, await res.text().catch(() => ''))
      return null
    }
    const json = (await res.json()) as SearchResponse
    const excluded = new Set(excludedUris)
    const candidates = (json.tracks?.items ?? []).filter(
      (item): item is SpotifyTrackItem => item != null && !excluded.has(item.uri)
    )
    const match = candidates
      .map((item, index) => ({ item, score: scoreTrack(item, query, index) }))
      .sort((a, b) => b.score - a.score)[0]?.item
    if (!match) return null
    return {
      lane: '',
      query,
      querySource: 'fallback',
      trackId: match.id,
      uri: match.uri,
      name: match.name,
      description: match.album.name,
      imageUrl: match.album.images?.[0]?.url ?? null,
      externalUrl: match.external_urls.spotify ?? null,
      artistName: match.artists.map((artist) => artist.name).join(', ') || null
    }
  } catch (err) {
    console.warn('[fuzzy spotify] search request failed', err)
    return null
  }
}

export async function suggestForMood(
  classification: AmbientClassification,
  options: SpotifySuggestionOptions = {}
): Promise<SpotifySuggestion | null> {
  const plan = await planSoundtrackQuery(classification, {
    passageExcerpt: options.passageExcerpt,
    documentId: options.documentId,
    pageNumber: options.pageNumber
  })
  const result = await searchPlan(plan, options.excludeUris ?? [])
  return result
    ? { ...result, lane: plan.lane, query: plan.query, querySource: plan.source }
    : null
}

async function searchPlan(
  plan: SoundtrackQueryPlan,
  excludedUris: readonly string[]
): Promise<SpotifySuggestion | null> {
  const queries = [plan.query, ...(plan.queries ?? [])].filter(
    (query, index, all): query is string =>
      typeof query === 'string' && query.trim().length > 0 && all.indexOf(query) === index
  )
  for (const query of queries) {
    const result = await searchTrack(query, excludedUris)
    if (result) return result
  }
  return null
}

export async function playSuggestion(
  suggestion: SpotifySuggestion
): Promise<SpotifyPlaybackResult> {
  if (!suggestion.uri) {
    return {
      ok: false,
      started: false,
      openedExternal: false,
      reason: 'invalid-suggestion',
      message: 'This soundtrack does not include a playable Spotify track.'
    }
  }
  return playSpotifyDesktopTrack(suggestion.uri)
}

export async function restorePlayback(
  snapshot: SpotifyPlaybackSnapshot
): Promise<SpotifyRestoreResult> {
  return restoreSpotifyDesktopTrack(snapshot)
}
