import { describe, expect, it } from 'vitest'
import { buildAuthorizeUrl, SPOTIFY_SCOPES } from '../src/main/services/spotify/spotifyOAuth'

describe('Spotify OAuth playback permissions', () => {
  it('requests only Spotify Connect read and playback-control scopes', () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: 'client-id',
        codeChallenge: 'challenge',
        state: 'state'
      })
    )

    expect(url.searchParams.get('scope')?.split(' ').sort()).toEqual([...SPOTIFY_SCOPES].sort())
  })
})
