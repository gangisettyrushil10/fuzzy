import type {
  AmbientClassification,
  SpotifyPlaybackResult,
  SpotifyPlaybackSnapshot,
  SpotifyRestoreResult,
  SpotifySuggestion,
  SpotifySuggestionOptions
} from '@shared/types/api'
import { getValidAccessToken } from './spotifyAuthFlow'
import { buildSoundtrackLane } from './moodMusicMap'
import { readGenrePreferences, readSpotifyStatus } from './spotifyTokenStore'

const REQUEST_TIMEOUT_MS = 8_000

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

interface SpotifyDevice {
  id: string | null
  is_active: boolean
  is_restricted: boolean
}

interface PlaybackStateResponse {
  device?: SpotifyDevice
  progress_ms?: number | null
  item?: (SpotifyTrackItem & { type?: string }) | null
}

interface DevicesResponse {
  devices?: SpotifyDevice[]
}

function withTastePreference(query: string, genrePreferences: readonly string[]): string {
  const preference = genrePreferences[0]
  return preference ? `${preference} ${query}` : query
}

async function spotifyFetch(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(`https://api.spotify.com/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers
      },
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

  const params = new URLSearchParams({ q: query, type: 'track', limit: '20' })
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
  const { lane, query } = buildSoundtrackLane(classification)
  const biasedQuery = withTastePreference(query, readGenrePreferences())
  const result = await searchTrack(biasedQuery, options.excludeUris ?? [])
  return result ? { ...result, lane } : null
}

async function readPlaybackState(token: string): Promise<PlaybackStateResponse | null> {
  try {
    const res = await spotifyFetch(token, '/me/player')
    if (res.status === 204 || !res.ok) return null
    return (await res.json()) as PlaybackStateResponse
  } catch {
    return null
  }
}

function playbackSnapshot(state: PlaybackStateResponse | null): SpotifyPlaybackSnapshot | null {
  const item = state?.item
  if (!item?.uri || item.type === 'episode') return null
  return {
    uri: item.uri,
    name: item.name ?? null,
    artistName: item.artists?.map((artist) => artist.name).join(', ') || null,
    imageUrl: item.album?.images?.[0]?.url ?? null,
    externalUrl: item.external_urls?.spotify ?? null,
    progressMs: Math.max(0, state?.progress_ms ?? 0)
  }
}

async function findPlayableDevice(
  token: string,
  state: PlaybackStateResponse | null
): Promise<string | null> {
  const current = state?.device
  if (current?.id && !current.is_restricted) return current.id
  try {
    const res = await spotifyFetch(token, '/me/player/devices')
    if (!res.ok) return null
    const json = (await res.json()) as DevicesResponse
    const device = json.devices?.find((candidate) => candidate.id && !candidate.is_restricted)
    return device?.id ?? null
  } catch {
    return null
  }
}

function unavailableResult(status: number): Extract<SpotifyPlaybackResult, { ok: false }> {
  if (status === 403) {
    return {
      ok: false,
      started: false,
      openedExternal: false,
      reason: 'premium-required',
      message: 'Spotify direct playback requires Premium. Opened the track in Spotify instead.'
    }
  }
  if (status === 404) {
    return {
      ok: false,
      started: false,
      openedExternal: false,
      reason: 'no-device',
      message: 'Open Spotify on a device, then try again. Opened the track for you.'
    }
  }
  return {
    ok: false,
    started: false,
    openedExternal: false,
    reason: 'playback-unavailable',
    message: 'Spotify could not start this track. Opened it in Spotify instead.'
  }
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

  const token = await getValidAccessToken()
  if (!token) {
    return {
      ok: false,
      started: false,
      openedExternal: false,
      reason: 'not-connected',
      message: 'Reconnect Spotify to start playback.'
    }
  }
  if (!readSpotifyStatus().playbackControl) {
    return {
      ok: false,
      started: false,
      openedExternal: false,
      reason: 'reconnect-required',
      message: 'Reconnect Spotify once to enable one-click playback.'
    }
  }

  const state = await readPlaybackState(token)
  const deviceId = await findPlayableDevice(token, state)
  if (!deviceId) {
    return {
      ok: false,
      started: false,
      openedExternal: false,
      reason: 'no-device',
      message: 'Open Spotify on a device, then try again. Opened the track for you.'
    }
  }

  try {
    const params = new URLSearchParams({ device_id: deviceId })
    const res = await spotifyFetch(token, `/me/player/play?${params.toString()}`, {
      method: 'PUT',
      body: JSON.stringify({ uris: [suggestion.uri], position_ms: 0 })
    })
    if (!res.ok) return unavailableResult(res.status)
    return {
      ok: true,
      started: true,
      openedExternal: false,
      previous: playbackSnapshot(state)
    }
  } catch {
    return unavailableResult(0)
  }
}

export async function restorePlayback(
  snapshot: SpotifyPlaybackSnapshot
): Promise<SpotifyRestoreResult> {
  const token = await getValidAccessToken()
  if (!token || !readSpotifyStatus().playbackControl) {
    return { ok: false, message: 'Reconnect Spotify to undo the soundtrack change.' }
  }
  const state = await readPlaybackState(token)
  const deviceId = await findPlayableDevice(token, state)
  if (!deviceId) return { ok: false, message: 'Open Spotify on a device, then try Undo again.' }

  try {
    const params = new URLSearchParams({ device_id: deviceId })
    const res = await spotifyFetch(token, `/me/player/play?${params.toString()}`, {
      method: 'PUT',
      body: JSON.stringify({
        uris: [snapshot.uri],
        position_ms: Math.max(0, Math.round(snapshot.progressMs))
      })
    })
    return res.ok
      ? { ok: true }
      : { ok: false, message: 'Spotify could not restore the previous track.' }
  } catch {
    return { ok: false, message: 'Spotify could not restore the previous track.' }
  }
}
