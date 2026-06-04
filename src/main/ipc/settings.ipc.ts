import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import {
  clearOpenaiKey,
  readSettings,
  validateOpenaiKey,
  writeLastActiveDocumentId,
  writeOpenaiKey,
  writeOpenaiModel,
  writeProviderMode
} from '../services/settingsService'
import type { ProviderMode } from '@shared/types/database'

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

  ipcMain.handle(IpcChannels.settingsClearOpenaiKey, () => clearOpenaiKey())

  ipcMain.handle(IpcChannels.settingsSetLastActiveDocumentId, (_e, id: unknown) => {
    if (id !== null && typeof id !== 'string') {
      throw new Error('lastActiveDocumentId must be a string or null.')
    }
    return writeLastActiveDocumentId(id as string | null)
  })
}
