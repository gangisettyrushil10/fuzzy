import { describe, expect, it } from 'vitest'
import { buildAuthorizeUrl, SPOTIFY_SCOPES } from '../src/main/services/spotify/spotifyOAuth'

describe('Spotify OAuth permissions', () => {
  it('does not request library or Spotify Connect playback scopes', () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: 'client-id',
        codeChallenge: 'challenge',
        state: 'state'
      })
    )

    expect(SPOTIFY_SCOPES).toEqual([])
    expect(url.searchParams.has('scope')).toBe(false)
  })
})
