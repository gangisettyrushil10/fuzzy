import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import { generateReadingPlan } from '../services/readingPlanService'
import { getDocument } from '../db/repositories/documentRepository'
import { listPagesForDocument } from '../db/repositories/pageRepository'
import {
  getLatestSessionForDocument,
  insertReadingSession
} from '../db/repositories/readingSessionRepository'

const MIN_MINUTES = 1
const MAX_MINUTES = 24 * 60

export function registerReadingSessionIpc(): void {
  ipcMain.handle(
    IpcChannels.readingSessionsCreate,
    (_e, documentId: unknown, availableMinutes: unknown) => {
      if (typeof documentId !== 'string' || !documentId) {
        throw new Error('documentId is required.')
      }
      const minutes = Number(availableMinutes)
      if (!Number.isFinite(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
        throw new Error(`availableMinutes must be between ${MIN_MINUTES} and ${MAX_MINUTES}.`)
      }
      const doc = getDocument(documentId)
      if (!doc) throw new Error('Document not found.')
      const pages = listPagesForDocument(documentId)
      const plan = generateReadingPlan({
        documentId,
        availableMinutes: Math.round(minutes),
        pages
      })
      return insertReadingSession({
        documentId,
        availableMinutes: plan.availableMinutes,
        estimatedMinutes: Math.round(plan.estimatedMinutes),
        plan
      })
    }
  )

  ipcMain.handle(IpcChannels.readingSessionsGetLatest, (_e, documentId: unknown) => {
    if (typeof documentId !== 'string' || !documentId) return null
    return getLatestSessionForDocument(documentId)
  })
}
