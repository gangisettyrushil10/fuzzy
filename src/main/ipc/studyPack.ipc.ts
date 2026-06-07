import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import { getDocument } from '../db/repositories/documentRepository'
import { listPagesForDocument } from '../db/repositories/pageRepository'
import {
  deleteStudyPack,
  getLatestStudyPackForDocument,
  listStudyPacksForDocument
} from '../db/repositories/studyPackRepository'
import { generateStudyPack } from '../services/studyPackService'
import { normalizeStudyPackOptions } from '@shared/types/database'

export function registerStudyPackIpc(): void {
  ipcMain.handle(
    IpcChannels.studyPacksGenerate,
    async (_e, documentId: unknown, options: unknown) => {
      if (typeof documentId !== 'string' || !documentId) {
        throw new Error('documentId is required.')
      }
      const doc = getDocument(documentId)
      if (!doc) throw new Error('Document not found.')
      const pages = listPagesForDocument(documentId)
      // Re-normalize the untrusted options patch so a bad value can't reach the
      // model or the schema builder.
      const opts = normalizeStudyPackOptions(options)
      try {
        return await generateStudyPack({ document: doc, pages }, opts)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Study pack generation failed.'
        // Don't leak SDK internals to the renderer.
        throw new Error(msg)
      }
    }
  )

  ipcMain.handle(IpcChannels.studyPacksGetLatest, (_e, documentId: unknown) => {
    if (typeof documentId !== 'string' || !documentId) return null
    return getLatestStudyPackForDocument(documentId)
  })

  ipcMain.handle(IpcChannels.studyPacksList, (_e, documentId: unknown) => {
    if (typeof documentId !== 'string' || !documentId) return []
    return listStudyPacksForDocument(documentId)
  })

  ipcMain.handle(IpcChannels.studyPacksDelete, (_e, id: unknown) => {
    if (typeof id !== 'string' || !id) throw new Error('id is required.')
    deleteStudyPack(id)
    return { ok: true }
  })
}
