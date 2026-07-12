import { randomBytes, createHash } from 'crypto'
import type { SpotifyTokens } from './spotifyTokenStore'

// Loopback redirect target for Electron's Authorization Code + PKCE flow.
// Spotify validates the redirect URI by exact string match, so this port must
// be registered verbatim in the app's Spotify Dashboard settings.
export const SPOTIFY_LOOPBACK_PORT = 51821
export const SPOTIFY_REDIRECT_URI = `http://127.0.0.1:${SPOTIFY_LOOPBACK_PORT}/callback`

// Deliberately empty: playlist/track search over Spotify's public catalog
// needs a valid user token but no specific scope. Keeping this empty means
// the consent screen asks for nothing beyond "know who's logged in," and we
// never touch the user's library or playback. See Fuzzy CLAUDE.md notes on
// the Spotify Ambient Companion feature for why write/playback scopes were
// deliberately deferred.
export const SPOTIFY_SCOPE = ''

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function generateCodeVerifier(): string {
  return base64url(randomBytes(64))
}

export function generateCodeChallenge(verifier: string): string {
  return base64url(createHash('sha256').update(verifier).digest())
}

export function generateState(): string {
  return base64url(randomBytes(16))
}

export function buildAuthorizeUrl(params: {
  clientId: string
  codeChallenge: string
  state: string
}): string {
  const url = new URL('https://accounts.spotify.com/authorize')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', SPOTIFY_REDIRECT_URI)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('state', params.state)
  if (SPOTIFY_SCOPE) url.searchParams.set('scope', SPOTIFY_SCOPE)
  return url.toString()
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  error?: string
  error_description?: string
}

async function postTokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  const json = (await res.json()) as TokenResponse
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || `Spotify token request failed (${res.status})`
    )
  }
  return json
}

export async function exchangeCodeForToken(params: {
  clientId: string
  code: string
  codeVerifier: string
}): Promise<SpotifyTokens> {
  const json = await postTokenRequest(
    new URLSearchParams({
      client_id: params.clientId,
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      code_verifier: params.codeVerifier
    })
  )
  if (!json.refresh_token) {
    throw new Error('Spotify did not return a refresh token.')
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000
  }
}

export async function refreshAccessToken(params: {
  clientId: string
  refreshToken: string
}): Promise<{ accessToken: string; refreshToken?: string; expiresAt: number }> {
  const json = await postTokenRequest(
    new URLSearchParams({
      client_id: params.clientId,
      grant_type: 'refresh_token',
      refresh_token: params.refreshToken
    })
  )
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000
  }
}
