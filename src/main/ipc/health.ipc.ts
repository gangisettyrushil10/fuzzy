import { app, ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import type { HealthPingResult } from '@shared/types/api'

export function registerHealthIpc(): void {
  ipcMain.handle(IpcChannels.healthPing, (): HealthPingResult => {
    return {
      ok: true,
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome
    }
  })
}
