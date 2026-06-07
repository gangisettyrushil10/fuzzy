import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import { runArgumentMap } from '../services/argument/argumentMapService'

export function registerArgumentIpc(): void {
  ipcMain.handle(IpcChannels.argumentMap, (_e, documentId: unknown) => {
    if (typeof documentId !== 'string' || !documentId) throw new Error('documentId is required.')
    return runArgumentMap({ documentId })
  })
}
