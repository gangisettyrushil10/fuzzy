import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpotifySuggestion } from '../src/shared/types/api'

const mocks = vi.hoisted(() => ({
  getValidAccessToken: vi.fn(),
  readGenrePreferences: vi.fn(() => []),
  readSpotifyStatus: vi.fn(() => ({ playbackControl: true }))
}))

vi.mock('../src/main/services/spotify/spotifyAuthFlow', () => ({
  getValidAccessToken: mocks.getValidAccessToken
}))
vi.mock('../src/main/services/spotify/spotifyTokenStore', () => ({
  readGenrePreferences: mocks.readGenrePreferences,
  readSpotifyStatus: mocks.readSpotifyStatus
}))

import { playSuggestion, searchTrack } from '../src/main/services/spotify/spotifyApi'

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
    trackId: id,
    uri: `spotify:track:${id}`,
    name: `Track ${id}`,
    description: `Album ${id}`,
    imageUrl: `https://images.example/${id}.jpg`,
    externalUrl: `https://open.spotify.com/track/${id}`,
    artistName: `Artist ${id}`
  }
}

describe('Spotify track search and playback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getValidAccessToken.mockResolvedValue('token')
    mocks.readSpotifyStatus.mockReturnValue({ playbackControl: true })
  })

  it('skips a rejected search result and picks a fresh track', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ tracks: { items: [track('old'), track('fresh')] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    )

    const result = await searchTrack('calm instrumental', ['spotify:track:old'])

    expect(result?.uri).toBe('spotify:track:fresh')
    expect(result?.artistName).toBe('Artist fresh')
  })

  it('captures the current track and position before starting the replacement', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            device: { id: 'mac', is_active: true, is_restricted: false },
            progress_ms: 61_000,
            item: track('previous')
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await playSuggestion(suggestion('new'))

    expect(result).toMatchObject({
      ok: true,
      started: true,
      previous: { uri: 'spotify:track:previous', progressMs: 61_000 }
    })
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/me/player/play?device_id=mac'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ uris: ['spotify:track:new'], position_ms: 0 })
      })
    )
  })

  it('reports Premium playback rejection without pretending the track started', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              device: { id: 'mac', is_active: true, is_restricted: false },
              progress_ms: 0,
              item: track('previous')
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
        .mockResolvedValueOnce(new Response(null, { status: 403 }))
    )

    const result = await playSuggestion(suggestion('new'))

    expect(result).toMatchObject({ ok: false, started: false, reason: 'premium-required' })
  })
})
