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
const MIN_RELAXED_QUERY_TERMS = 3
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
const CORE_QUERY_TERMS = [
  ...READING_FRIENDLY_TERMS,
  'cyber',
  'fantasy',
  'noir',
  'mystery',
  'suspense',
  'tension',
  'pressure',
  'melancholy',
  'reflective',
  'urban',
  'night',
  'chamber',
  'adventure',
  'minimal',
  'dark',
  'soft'
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

function compactQuery(query: string, maxTerms: number): string {
  const seen = new Set<string>()
  const terms = normalize(query)
    .split(' ')
    .filter((term) => {
      if (seen.has(term)) return false
      seen.add(term)
      return CORE_QUERY_TERMS.includes(term) || term.length >= 5
    })
  return terms.slice(0, maxTerms).join(' ')
}

function fallbackQueries(plan: SoundtrackQueryPlan): string[] {
  const queries = [plan.query, ...(plan.queries ?? [])]
  const relaxed = queries.flatMap((query) => {
    const eight = compactQuery(query, 8)
    const five = compactQuery(query, 5)
    const three = compactQuery(query, 3)
    return [
      query,
      eight,
      five,
      three.split(' ').length >= MIN_RELAXED_QUERY_TERMS ? three : ''
    ]
  })
  return [
    ...relaxed,
    'instrumental score reading focus',
    'ambient instrumental focus'
  ].filter(
    (query, index, all): query is string =>
      typeof query === 'string' && query.trim().length > 0 && all.indexOf(query) === index
  )
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

function suggestionFromTrack(match: SpotifyTrackItem, query: string): SpotifySuggestion {
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
}

async function bestTrackForQuery(
  query: string,
  excludedUris: readonly string[]
): Promise<{ fresh: SpotifySuggestion | null; fallback: SpotifySuggestion | null }> {
  const token = await getValidAccessToken()
  if (!token) return { fresh: null, fallback: null }

  const params = new URLSearchParams({ q: query, type: 'track', limit: SEARCH_RESULT_LIMIT })
  const res = await spotifyFetch(token, `/search?${params.toString()}`)
  if (!res.ok) {
    console.warn('[fuzzy spotify] search failed', res.status, await res.text().catch(() => ''))
    return { fresh: null, fallback: null }
  }
  const json = (await res.json()) as SearchResponse
  const excluded = new Set(excludedUris)
  const ranked = (json.tracks?.items ?? [])
    .filter((item): item is SpotifyTrackItem => item != null)
    .map((item, index) => ({ item, score: scoreTrack(item, query, index) }))
    .sort((a, b) => b.score - a.score)
  const fresh = ranked.find(({ item }) => !excluded.has(item.uri))?.item ?? null
  const fallback = ranked[0]?.item ?? null
  return {
    fresh: fresh ? suggestionFromTrack(fresh, query) : null,
    fallback: fallback ? suggestionFromTrack(fallback, query) : null
  }
}

export async function searchTrack(
  query: string,
  excludedUris: readonly string[] = []
): Promise<SpotifySuggestion | null> {
  try {
    const result = await bestTrackForQuery(query, excludedUris)
    return result.fresh ?? result.fallback
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
  let fallback: SpotifySuggestion | null = null
  for (const query of fallbackQueries(plan)) {
    try {
      const result = await bestTrackForQuery(query, excludedUris)
      if (result.fresh) return result.fresh
      fallback ??= result.fallback
    } catch (err) {
      console.warn('[fuzzy spotify] search request failed', err)
    }
  }
  return fallback
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
