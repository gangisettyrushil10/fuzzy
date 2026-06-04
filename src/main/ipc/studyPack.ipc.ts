import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import { getDocument } from '../db/repositories/documentRepository'
import { listPagesForDocument } from '../db/repositories/pageRepository'
import {
  getLatestStudyPackForDocument,
  insertStudyPack as _insertStudyPack
} from '../db/repositories/studyPackRepository'
import { generateStudyPack } from '../services/studyPackService'

// `_insertStudyPack` import keeps the repo as a referenced module — the
// service uses it through its own import. (Avoids a stray "unused" lint.)
void _insertStudyPack

export function registerStudyPackIpc(): void {
  ipcMain.handle(IpcChannels.studyPacksGenerate, async (_e, documentId: unknown) => {
    if (typeof documentId !== 'string' || !documentId) {
      throw new Error('documentId is required.')
    }
    const doc = getDocument(documentId)
    if (!doc) throw new Error('Document not found.')
    const pages = listPagesForDocument(documentId)
    try {
      return await generateStudyPack({ document: doc, pages })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Study pack generation failed.'
      // Don't leak SDK internals to the renderer.
      throw new Error(msg)
    }
  })

  ipcMain.handle(IpcChannels.studyPacksGetLatest, (_e, documentId: unknown) => {
    if (typeof documentId !== 'string' || !documentId) return null
    return getLatestStudyPackForDocument(documentId)
  })
}
