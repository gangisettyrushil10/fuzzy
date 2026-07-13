import type { AmbientClassification, SpotifySuggestion } from '@shared/types/api'
import { getValidAccessToken } from './spotifyAuthFlow'
import { buildSoundtrackLane } from './moodMusicMap'
import { readGenrePreferences } from './spotifyTokenStore'

const SEARCH_TIMEOUT_MS = 8_000

interface SpotifyImage {
  url: string
}

interface SpotifyPlaylistItem {
  id: string
  name: string
  description: string | null
  images: SpotifyImage[] | null
  external_urls: { spotify?: string }
  owner: { display_name?: string }
  uri: string
}

interface SearchResponse {
  playlists?: { items: Array<SpotifyPlaylistItem | null> }
}

// Layers up to one saved taste tag (e.g. "lo-fi", "classical") onto the base
// mood query so results skew toward genres the user actually likes, without
// letting an unbounded preference list drown out the mood itself.
function withTastePreference(query: string, genrePreferences: readonly string[]): string {
  const preference = genrePreferences[0]
  return preference ? `${preference} ${query}` : query
}

export async function searchPlaylist(query: string): Promise<SpotifySuggestion | null> {
  const token = await getValidAccessToken()
  if (!token) return null

  const url = new URL('https://api.spotify.com/v1/search')
  url.searchParams.set('q', query)
  url.searchParams.set('type', 'playlist')
  url.searchParams.set('limit', '5')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
    if (!res.ok) {
      console.warn('[fuzzy spotify] search failed', res.status, await res.text().catch(() => ''))
      return null
    }
    const json = (await res.json()) as SearchResponse
    const top = json.playlists?.items.find((item): item is SpotifyPlaylistItem => item != null)
    if (!top) return null
    return {
      lane: '',
      query,
      playlistId: top.id,
      name: top.name,
      description: top.description,
      imageUrl: top.images?.[0]?.url ?? null,
      externalUrl: top.external_urls.spotify ?? null,
      ownerName: top.owner.display_name ?? null
    }
  } catch (err) {
    console.warn('[fuzzy spotify] search request failed', err)
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function suggestForMood(
  classification: AmbientClassification
): Promise<SpotifySuggestion | null> {
  const { lane, query } = buildSoundtrackLane(classification)
  const biasedQuery = withTastePreference(query, readGenrePreferences())
  const result = await searchPlaylist(biasedQuery)
  return result ? { ...result, lane } : null
}
