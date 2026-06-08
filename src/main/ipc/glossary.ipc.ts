import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import { buildGlossary } from '../services/glossary/glossaryService'

export function registerGlossaryIpc(): void {
  ipcMain.handle(IpcChannels.glossaryBuild, (_e, documentId: unknown) => {
    if (typeof documentId !== 'string' || !documentId) throw new Error('documentId is required.')
    return buildGlossary(documentId)
  })
}
