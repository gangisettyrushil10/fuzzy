import { ipcMain, BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { IpcChannels } from '@shared/ipc/channels'
import {
  deleteDocument,
  getDocument,
  insertDocument,
  listDocuments,
  setPageCount,
  touchLastOpened
} from '../db/repositories/documentRepository'
import { listAnnotationsForDocument } from '../db/repositories/annotationRepository'
import { listPagesForDocument, upsertPage } from '../db/repositories/pageRepository'
import {
  importSampleDocument,
  openImportDialog,
  readDocumentBytes,
  unlinkDocumentFile
} from '../services/fileService'
import { PathEscapeError } from '../services/pathSafety'
import type { ExtractedPagePayload } from '@shared/types/database'

const MAX_PAGE_TEXT_CHARS = 200_000

export function registerDocumentIpc(): void {
  ipcMain.handle(IpcChannels.documentsList, () => listDocuments())

  ipcMain.handle(IpcChannels.documentsGet, (_e, id: string) => getDocument(id))

  ipcMain.handle(IpcChannels.documentsTouch, (_e, id: string) => {
    touchLastOpened(id)
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.documentsDelete, async (_e, id: string) => {
    // Look up the row first so we can unlink the backing file *after* the DB
    // delete succeeds. unlinkDocumentFile path-checks against libraryDir.
    const doc = getDocument(id)
    deleteDocument(id)
    if (doc?.filePath) {
      await unlinkDocumentFile(doc.filePath).catch((err) =>
        console.warn('[fuzzy] unlinkDocumentFile failed', err)
      )
    }
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.documentsImport, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return openImportDialog(win)
  })

  ipcMain.handle(IpcChannels.documentsImportSample, () => importSampleDocument())

  ipcMain.handle(IpcChannels.documentsReadFile, async (_e, id: string) => {
    if (typeof id !== 'string' || id.length === 0) return null
    const doc = getDocument(id)
    if (!doc) return null
    try {
      return await readDocumentBytes(doc.filePath)
    } catch (err) {
      if (err instanceof PathEscapeError) {
        // Refuse the read, log it, and surface a sanitized error to the
        // renderer rather than the raw filesystem string.
        console.warn(`[fuzzy] refused readFile for document ${id} — path escaped libraryDir`)
        throw new Error('Document cannot be read from this location.')
      }
      throw err
    }
  })

  ipcMain.handle(
    IpcChannels.documentsRecordPageExtraction,
    (_e, documentId: string, page: ExtractedPagePayload) => {
      if (typeof documentId !== 'string' || !documentId) {
        throw new Error('documentId is required.')
      }
      if (!page || typeof page !== 'object') {
        throw new Error('page payload is required.')
      }
      const pageNumber = Number(page.pageNumber)
      if (!Number.isFinite(pageNumber) || pageNumber < 1) {
        throw new Error('page.pageNumber must be a positive integer.')
      }
      const text = typeof page.textContent === 'string' ? page.textContent : ''
      const safeText = text.length > MAX_PAGE_TEXT_CHARS ? text.slice(0, MAX_PAGE_TEXT_CHARS) : text
      const wordCount = Number.isFinite(page.estimatedWordCount)
        ? Number(page.estimatedWordCount)
        : safeText.trim() === ''
          ? 0
          : safeText.split(/\s+/).filter(Boolean).length

      upsertPage({
        documentId,
        pageNumber,
        textContent: safeText,
        estimatedWordCount: wordCount
      })
      // Only widen page_count — never shrink it. A user paging out of order
      // shouldn't roll the count back when an earlier page is re-rendered.
      const doc = getDocument(documentId)
      const currentMax = doc?.pageCount ?? 0
      const nextMax = Math.max(currentMax, pageNumber)
      if (nextMax > currentMax) setPageCount(documentId, nextMax)
      return { ok: true as const, pageCount: nextMax }
    }
  )

  ipcMain.handle(IpcChannels.pagesListForDocument, (_e, documentId: string) =>
    listPagesForDocument(documentId)
  )

  ipcMain.handle(IpcChannels.annotationsListForDocument, (_e, documentId: string) =>
    listAnnotationsForDocument(documentId)
  )

  // Dev-only seed handler — gated behind is.dev so production builds never
  // register the channel. Combined with the dev-only preload exposure this
  // means a packaged app cannot insert poisoned filePath rows from renderer.
  if (is.dev) {
    ipcMain.handle(IpcChannels.devSeedDocument, () => {
      return insertDocument({
        title: `Test Document ${new Date().toLocaleTimeString()}`,
        filePath: '/dev/null',
        fileHash: null,
        pageCount: 0
      })
    })
  }
}
