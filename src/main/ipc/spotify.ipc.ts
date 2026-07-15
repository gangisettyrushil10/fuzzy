import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import type {
  AmbientClassification,
  SpotifyPlaybackMode,
  SpotifyPlaybackResult,
  SpotifyPlaybackSnapshot,
  SpotifySuggestion,
  SpotifySuggestionOptions
} from '@shared/types/api'
import { connectSpotify, disconnectSpotify } from '../services/spotify/spotifyAuthFlow'
import { playSuggestion, restorePlayback, suggestForMood } from '../services/spotify/spotifyApi'
import { activateSpotifyDesktopApp } from '../services/spotify/spotifyDesktopPlayer'
import {
  readSpotifyStatus,
  writeClientId,
  writeGenrePreferences,
  writePlaybackMode
} from '../services/spotify/spotifyTokenStore'

export function registerSpotifyIpc(): void {
  ipcMain.handle(IpcChannels.spotifyGetStatus, () => readSpotifyStatus())

  ipcMain.handle(IpcChannels.spotifySetClientId, (_e, clientId: unknown) => {
    if (typeof clientId !== 'string') throw new Error('Client ID must be a string.')
    writeClientId(clientId)
    return readSpotifyStatus()
  })

  ipcMain.handle(IpcChannels.spotifyConnect, () => connectSpotify())

  ipcMain.handle(IpcChannels.spotifyDisconnect, () => {
    disconnectSpotify()
    return readSpotifyStatus()
  })

  ipcMain.handle(IpcChannels.spotifySetPlaybackMode, (_e, mode: unknown) => {
    if (mode !== 'suggest' && mode !== 'auto') {
      throw new Error('playbackMode must be "suggest" or "auto".')
    }
    writePlaybackMode(mode as SpotifyPlaybackMode)
    return readSpotifyStatus()
  })

  ipcMain.handle(IpcChannels.spotifySetGenrePreferences, (_e, genres: unknown) => {
    if (!Array.isArray(genres) || !genres.every((g) => typeof g === 'string')) {
      throw new Error('genrePreferences must be a string array.')
    }
    writeGenrePreferences(genres as string[])
    return readSpotifyStatus()
  })

  ipcMain.handle(
    IpcChannels.spotifySuggestForMood,
    (_e, classification: unknown, options: unknown) => {
      if (!classification || typeof classification !== 'object') return null
      const candidate = options as Partial<SpotifySuggestionOptions> | null
      const excludeUris = Array.isArray(candidate?.excludeUris)
        ? candidate.excludeUris.filter((uri): uri is string => typeof uri === 'string').slice(0, 12)
        : []
      const passageExcerpt =
        typeof candidate?.passageExcerpt === 'string'
          ? candidate.passageExcerpt.trim().slice(0, 2_000)
          : undefined
      return suggestForMood(classification as AmbientClassification, {
        excludeUris,
        passageExcerpt
      })
    }
  )

  ipcMain.handle(IpcChannels.spotifyPlaySuggestion, (_e, suggestion: unknown) => {
    const candidate = suggestion as Partial<SpotifySuggestion> | null
    if (!candidate || typeof candidate !== 'object') {
      return {
        ok: false,
        started: false,
        openedExternal: false,
        reason: 'invalid-suggestion',
        message: 'This soundtrack is no longer available.'
      } satisfies SpotifyPlaybackResult
    }
    return playSuggestion(candidate as SpotifySuggestion)
  })

  ipcMain.handle(IpcChannels.spotifyRestorePlayback, (_e, snapshot: unknown) => {
    const candidate = snapshot as Partial<SpotifyPlaybackSnapshot> | null
    if (
      !candidate ||
      typeof candidate.uri !== 'string' ||
      !candidate.uri.startsWith('spotify:track:')
    ) {
      return { ok: false, message: 'The previous Spotify track is no longer available.' }
    }
    return restorePlayback(candidate as SpotifyPlaybackSnapshot)
  })

  ipcMain.handle(IpcChannels.spotifyOpenSuggestion, () => activateSpotifyDesktopApp())
}
