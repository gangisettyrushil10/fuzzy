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

const REQUEST_TIMEOUT_MS = 8_000
const SEARCH_RESULT_LIMIT = '10'

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
    const match = json.tracks?.items.find(
      (item): item is SpotifyTrackItem => item != null && !excluded.has(item.uri)
    )
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
  const plan = await planSoundtrackQuery(classification, options.passageExcerpt)
  const result = await searchTrack(plan.query, options.excludeUris ?? [])
  return result
    ? { ...result, lane: plan.lane, query: plan.query, querySource: plan.source }
    : null
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
