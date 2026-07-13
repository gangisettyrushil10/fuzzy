import { safeStorage } from 'electron'
import { deleteSetting, getSetting, setSetting } from '../../db/repositories/settingsRepository'
import type { SpotifyPlaybackMode, SpotifyStatus } from '@shared/types/api'
import { SPOTIFY_SCOPES } from './spotifyOAuth'

// Same discipline as the OpenAI key in settingsService.ts: secrets are
// encrypted via safeStorage (macOS Keychain-backed) and only ever decrypted
// inside the main process. The Client ID is not a secret (Spotify's PKCE flow
// has no client secret) so it's stored in plaintext.
const KEY_CLIENT_ID = 'spotify.clientId'
const KEY_ACCESS_TOKEN_ENC = 'spotify.accessToken.enc.b64'
const KEY_REFRESH_TOKEN_ENC = 'spotify.refreshToken.enc.b64'
const KEY_EXPIRES_AT = 'spotify.expiresAt'
const KEY_SCOPES = 'spotify.scopes'
const KEY_PLAYBACK_MODE = 'spotify.playbackMode'
const KEY_GENRE_PREFS = 'spotify.genrePreferences'

export interface SpotifyTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  scopes: string[]
}

function encrypt(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'Secure storage is not available on this machine. Sign in to your Mac account and try again.'
    )
  }
  return safeStorage.encryptString(value).toString('base64')
}

function decrypt(stored: string): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'))
  } catch (err) {
    console.error('[fuzzy spotify] failed to decrypt token', err)
    return null
  }
}

export function readClientId(): string | null {
  return getSetting(KEY_CLIENT_ID)
}

export function writeClientId(clientId: string): void {
  const trimmed = clientId.trim()
  if (!trimmed) {
    deleteSetting(KEY_CLIENT_ID)
    return
  }
  setSetting(KEY_CLIENT_ID, trimmed)
}

export function readTokens(): SpotifyTokens | null {
  const accessEnc = getSetting(KEY_ACCESS_TOKEN_ENC)
  const refreshEnc = getSetting(KEY_REFRESH_TOKEN_ENC)
  const expiresAtRaw = getSetting(KEY_EXPIRES_AT)
  if (!accessEnc || !refreshEnc || !expiresAtRaw) return null
  const accessToken = decrypt(accessEnc)
  const refreshToken = decrypt(refreshEnc)
  if (!accessToken || !refreshToken) return null
  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt)) return null
  const scopes = (getSetting(KEY_SCOPES) ?? '').split(/\s+/).filter(Boolean)
  return { accessToken, refreshToken, expiresAt, scopes }
}

export function writeTokens(tokens: SpotifyTokens): void {
  setSetting(KEY_ACCESS_TOKEN_ENC, encrypt(tokens.accessToken))
  setSetting(KEY_REFRESH_TOKEN_ENC, encrypt(tokens.refreshToken))
  setSetting(KEY_EXPIRES_AT, String(tokens.expiresAt))
  setSetting(KEY_SCOPES, tokens.scopes.join(' '))
}

// Access tokens rotate on refresh; the refresh token usually doesn't (Spotify
// only issues a new one sometimes). Keep the existing one when absent.
export function writeAccessToken(
  accessToken: string,
  expiresAt: number,
  refreshToken?: string
): void {
  setSetting(KEY_ACCESS_TOKEN_ENC, encrypt(accessToken))
  setSetting(KEY_EXPIRES_AT, String(expiresAt))
  if (refreshToken) {
    setSetting(KEY_REFRESH_TOKEN_ENC, encrypt(refreshToken))
  }
}

export function clearTokens(): void {
  deleteSetting(KEY_ACCESS_TOKEN_ENC)
  deleteSetting(KEY_REFRESH_TOKEN_ENC)
  deleteSetting(KEY_EXPIRES_AT)
  deleteSetting(KEY_SCOPES)
}

export function readPlaybackMode(): SpotifyPlaybackMode {
  return getSetting(KEY_PLAYBACK_MODE) === 'auto' ? 'auto' : 'suggest'
}

export function writePlaybackMode(mode: SpotifyPlaybackMode): void {
  setSetting(KEY_PLAYBACK_MODE, mode)
}

export function readGenrePreferences(): string[] {
  const raw = getSetting(KEY_GENRE_PREFS)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string').slice(0, 12) : []
  } catch {
    return []
  }
}

export function writeGenrePreferences(genres: string[]): void {
  const cleaned = genres
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12)
  setSetting(KEY_GENRE_PREFS, JSON.stringify(cleaned))
}

export function readSpotifyStatus(): SpotifyStatus {
  const tokens = readTokens()
  return {
    configured: readClientId() !== null,
    connected: tokens !== null,
    playbackControl: SPOTIFY_SCOPES.every((scope) => tokens?.scopes.includes(scope)),
    playbackMode: readPlaybackMode(),
    genrePreferences: readGenrePreferences()
  }
}
