import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import { runAsk } from '../services/ask/askService'
import type { AskRequest } from '@shared/types/database'

const MAX_QUESTION_CHARS = 500

function validate(input: unknown): AskRequest {
  if (!input || typeof input !== 'object') throw new Error('Invalid ask request.')
  const r = input as Partial<AskRequest>
  if (typeof r.documentId !== 'string' || !r.documentId) throw new Error('documentId is required.')
  if (typeof r.question !== 'string' || !r.question.trim()) throw new Error('question is required.')
  return {
    documentId: r.documentId,
    question: r.question.slice(0, MAX_QUESTION_CHARS),
    spoilerSafe: r.spoilerSafe === true,
    currentPage: typeof r.currentPage === 'number' ? r.currentPage : null,
    limit: typeof r.limit === 'number' ? r.limit : undefined,
    webSearch: r.webSearch === true
  }
}

export function registerAskIpc(): void {
  ipcMain.handle(IpcChannels.askQuery, (_e, raw: unknown) => runAsk(validate(raw)))
}
