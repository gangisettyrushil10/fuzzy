import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpotifySuggestion } from '../src/shared/types/api'

const mocks = vi.hoisted(() => ({
  getValidAccessToken: vi.fn(),
  playSpotifyDesktopTrack: vi.fn(),
  planSoundtrackQuery: vi.fn()
}))

vi.mock('../src/main/services/spotify/spotifyAuthFlow', () => ({
  getValidAccessToken: mocks.getValidAccessToken
}))
vi.mock('../src/main/services/spotify/spotifyDesktopPlayer', () => ({
  playSpotifyDesktopTrack: mocks.playSpotifyDesktopTrack,
  restoreSpotifyDesktopTrack: vi.fn()
}))
vi.mock('../src/main/services/spotify/soundtrackQueryService', () => ({
  planSoundtrackQuery: mocks.planSoundtrackQuery
}))

import { playSuggestion, searchTrack, suggestForMood } from '../src/main/services/spotify/spotifyApi'

function track(id: string): Record<string, unknown> {
  return {
    id,
    name: `Track ${id}`,
    uri: `spotify:track:${id}`,
    artists: [{ name: `Artist ${id}` }],
    album: { name: `Album ${id}`, images: [{ url: `https://images.example/${id}.jpg` }] },
    external_urls: { spotify: `https://open.spotify.com/track/${id}` },
    type: 'track'
  }
}

function suggestion(id: string): SpotifySuggestion {
  return {
    lane: 'Deep focus',
    query: 'calm instrumental focus',
    querySource: 'fallback',
    trackId: id,
    uri: `spotify:track:${id}`,
    name: `Track ${id}`,
    description: `Album ${id}`,
    imageUrl: `https://images.example/${id}.jpg`,
    externalUrl: `https://open.spotify.com/track/${id}`,
    artistName: `Artist ${id}`
  }
}

describe('Spotify track search and native playback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getValidAccessToken.mockResolvedValue('token')
    mocks.planSoundtrackQuery.mockResolvedValue({
      lane: 'Rain tension',
      query: 'rainy noir strings suspense instrumental',
      source: 'openai'
    })
  })

  it('skips a rejected search result and picks a fresh track', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ tracks: { items: [track('old'), track('fresh')] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await searchTrack('calm instrumental', ['spotify:track:old'])

    expect(result?.uri).toBe('spotify:track:fresh')
    expect(result?.artistName).toBe('Artist fresh')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('limit=10'), expect.any(Object))
  })

  it('sends the selected track URI to the installed Spotify app controller', async () => {
    const playbackResult = {
      ok: true,
      started: true,
      openedExternal: false,
      previous: null
    } as const
    mocks.playSpotifyDesktopTrack.mockResolvedValue(playbackResult)

    const result = await playSuggestion(suggestion('new'))

    expect(result).toEqual(playbackResult)
    expect(mocks.playSpotifyDesktopTrack).toHaveBeenCalledWith('spotify:track:new')
  })

  it('uses the passage-aware AI plan for a catalog track search', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ tracks: { items: [track('rain')] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const classification = {
      mood: 'tension',
      secondaryMood: 'fear',
      genre: 'mystery',
      type: 'fiction',
      intensity: 0.72,
      sceneTags: ['rain', 'night'],
      paletteHints: ['slate'],
      motion: 'pulse'
    } as const

    const result = await suggestForMood(classification, {
      passageExcerpt: 'Rain ran down the glass as the footsteps stopped outside.'
    })

    expect(mocks.planSoundtrackQuery).toHaveBeenCalledWith(
      classification,
      'Rain ran down the glass as the footsteps stopped outside.'
    )
    expect(result?.uri).toBe('spotify:track:rain')
    expect(result?.querySource).toBe('openai')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('type=track'),
      expect.any(Object)
    )
  })
})
