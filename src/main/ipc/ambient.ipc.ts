import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import { classifyPage } from '../services/ask/ambientClassifyService'

export function registerAmbientIpc(): void {
  ipcMain.handle(
    IpcChannels.ambientClassify,
    (_e, documentId: unknown, pageNumber: unknown, text: unknown) => {
      if (typeof documentId !== 'string' || !documentId) return null
      if (typeof pageNumber !== 'number') return null
      if (typeof text !== 'string' || !text.trim()) return null
      return classifyPage(documentId, pageNumber, text)
    }
  )
}
