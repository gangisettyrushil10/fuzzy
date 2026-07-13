import { shell } from 'electron'
import type { SpotifyConnectResult } from '@shared/types/api'
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  refreshAccessToken
} from './spotifyOAuth'
import { waitForOAuthCallback } from './spotifyOAuthServer'
import {
  clearTokens,
  readClientId,
  readSpotifyStatus,
  readTokens,
  writeAccessToken,
  writeTokens
} from './spotifyTokenStore'

// Refresh a little early so a request never races an expiring token.
const REFRESH_SKEW_MS = 60_000

let connecting = false

export async function connectSpotify(): Promise<SpotifyConnectResult> {
  const clientId = readClientId()
  if (!clientId) {
    return {
      ok: false,
      error: 'Add your Spotify Client ID in Settings first.',
      status: readSpotifyStatus()
    }
  }
  if (connecting) {
    return {
      ok: false,
      error: 'A Spotify connection is already in progress.',
      status: readSpotifyStatus()
    }
  }

  connecting = true
  try {
    const verifier = generateCodeVerifier()
    const challenge = generateCodeChallenge(verifier)
    const state = generateState()
    const authorizeUrl = buildAuthorizeUrl({ clientId, codeChallenge: challenge, state })

    const callbackPromise = waitForOAuthCallback(state)
    await shell.openExternal(authorizeUrl)
    const { code } = await callbackPromise

    const tokens = await exchangeCodeForToken({ clientId, code, codeVerifier: verifier })
    writeTokens(tokens)
    return { ok: true, status: readSpotifyStatus() }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to connect to Spotify.',
      status: readSpotifyStatus()
    }
  } finally {
    connecting = false
  }
}

export function disconnectSpotify(): void {
  clearTokens()
}

// Returns a usable access token, transparently refreshing when it's near
// expiry. Returns null when there's nothing connected or the refresh itself
// fails (e.g. the user revoked access from Spotify's side).
export async function getValidAccessToken(): Promise<string | null> {
  const clientId = readClientId()
  const tokens = readTokens()
  if (!clientId || !tokens) return null

  if (Date.now() < tokens.expiresAt - REFRESH_SKEW_MS) {
    return tokens.accessToken
  }

  try {
    const refreshed = await refreshAccessToken({ clientId, refreshToken: tokens.refreshToken })
    writeAccessToken(refreshed.accessToken, refreshed.expiresAt, refreshed.refreshToken)
    return refreshed.accessToken
  } catch (err) {
    console.error('[fuzzy spotify] token refresh failed', err)
    clearTokens()
    return null
  }
}
