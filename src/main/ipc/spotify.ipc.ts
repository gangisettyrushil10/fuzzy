import { ipcMain, shell } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import type {
  AmbientClassification,
  SpotifyPlaybackMode,
  SpotifySuggestion
} from '@shared/types/api'
import { isAllowedExternalScheme } from '../services/urlSafety'
import { connectSpotify, disconnectSpotify } from '../services/spotify/spotifyAuthFlow'
import { suggestForMood } from '../services/spotify/spotifyApi'
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

  ipcMain.handle(IpcChannels.spotifySuggestForMood, (_e, classification: unknown) => {
    if (!classification || typeof classification !== 'object') return null
    return suggestForMood(classification as AmbientClassification)
  })

  ipcMain.handle(IpcChannels.spotifyOpenSuggestion, async (_e, suggestion: unknown) => {
    const s = suggestion as Partial<SpotifySuggestion> | null
    const url = s?.externalUrl
    if (typeof url !== 'string' || !isAllowedExternalScheme(url)) {
      return { ok: false }
    }
    await shell.openExternal(url)
    return { ok: true }
  })
}
