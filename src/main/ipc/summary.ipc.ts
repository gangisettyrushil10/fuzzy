import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import { generateChapterSummaries, generateDigest } from '../services/summary/summaryService'

export function registerSummaryIpc(): void {
  ipcMain.handle(IpcChannels.summaryDigest, (_e, documentId: unknown, targetMinutes: unknown) => {
    if (typeof documentId !== 'string' || !documentId) throw new Error('documentId is required.')
    const minutes =
      typeof targetMinutes === 'number' && Number.isFinite(targetMinutes)
        ? Math.min(60, Math.max(1, Math.round(targetMinutes)))
        : 10
    return generateDigest(documentId, minutes)
  })

  ipcMain.handle(IpcChannels.summaryChapters, (_e, documentId: unknown) => {
    if (typeof documentId !== 'string' || !documentId) throw new Error('documentId is required.')
    return generateChapterSummaries(documentId)
  })
}
