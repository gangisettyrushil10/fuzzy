import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import {
  clearOpenaiKey,
  readAppearancePrefs,
  readReaderPrefs,
  readSettings,
  readStudyPackPrefs,
  validateOpenaiKey,
  writeAppearancePrefs,
  writeLastActiveDocumentId,
  writeOpenaiBaseUrl,
  writeOpenaiKey,
  writeOpenaiModel,
  writeProviderMode,
  writeReaderPrefs,
  writeStudyPackPrefs
} from '../services/settingsService'
import type {
  AppearancePrefs,
  ProviderMode,
  ReaderPrefs,
  StudyPackPrefs
} from '@shared/types/database'

export function registerSettingsIpc(): void {
  ipcMain.handle(IpcChannels.settingsGet, () => readSettings())

  ipcMain.handle(IpcChannels.settingsSetProviderMode, (_e, mode: ProviderMode) => {
    if (mode !== 'mock' && mode !== 'openai') {
      throw new Error('providerMode must be "mock" or "openai".')
    }
    return writeProviderMode(mode)
  })

  ipcMain.handle(IpcChannels.settingsSetOpenaiKey, (_e, key: string) => {
    if (typeof key !== 'string') throw new Error('API key must be a string.')
    return writeOpenaiKey(key)
  })

  ipcMain.handle(IpcChannels.settingsValidateOpenaiKey, async (_e, key: string) => {
    if (typeof key !== 'string') throw new Error('API key must be a string.')
    return validateOpenaiKey(key)
  })

  ipcMain.handle(IpcChannels.settingsSetOpenaiModel, (_e, model: string) => {
    if (typeof model !== 'string') throw new Error('Model must be a string.')
    return writeOpenaiModel(model)
  })

  ipcMain.handle(IpcChannels.settingsSetOpenaiBaseUrl, (_e, url: unknown) => {
    if (url !== null && typeof url !== 'string') {
      throw new Error('Base URL must be a string or null.')
    }
    return writeOpenaiBaseUrl(url as string | null)
  })

  ipcMain.handle(IpcChannels.settingsClearOpenaiKey, () => clearOpenaiKey())

  ipcMain.handle(IpcChannels.settingsSetLastActiveDocumentId, (_e, id: unknown) => {
    if (id !== null && typeof id !== 'string') {
      throw new Error('lastActiveDocumentId must be a string or null.')
    }
    return writeLastActiveDocumentId(id as string | null)
  })

  ipcMain.handle(IpcChannels.settingsGetReaderPrefs, () => readReaderPrefs())

  ipcMain.handle(IpcChannels.settingsSetReaderPrefs, (_e, patch: unknown) => {
    if (patch === null || typeof patch !== 'object') {
      throw new Error('reader prefs patch must be an object.')
    }
    // writeReaderPrefs re-normalizes (clamps + validates) so untrusted fields
    // are safe.
    return writeReaderPrefs(patch as Partial<ReaderPrefs>)
  })

  ipcMain.handle(IpcChannels.settingsGetAppearancePrefs, () => readAppearancePrefs())

  ipcMain.handle(IpcChannels.settingsSetAppearancePrefs, (_e, patch: unknown) => {
    if (patch === null || typeof patch !== 'object') {
      throw new Error('appearance prefs patch must be an object.')
    }
    // writeAppearancePrefs re-normalizes (validates ids + hex) so untrusted
    // fields are safe.
    return writeAppearancePrefs(patch as Partial<AppearancePrefs>)
  })

  ipcMain.handle(IpcChannels.settingsGetStudyPackPrefs, () => readStudyPackPrefs())

  ipcMain.handle(IpcChannels.settingsSetStudyPackPrefs, (_e, patch: unknown) => {
    if (patch === null || typeof patch !== 'object') {
      throw new Error('study pack prefs patch must be an object.')
    }
    // writeStudyPackPrefs re-normalizes (clamps + validates) untrusted fields.
    return writeStudyPackPrefs(patch as Partial<StudyPackPrefs>)
  })
}
