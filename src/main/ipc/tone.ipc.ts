import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import { runToneSearch } from '../services/tone/toneSearchService'
import type { ToneSearchRequest } from '@shared/types/database'

function validate(input: unknown): ToneSearchRequest {
  if (!input || typeof input !== 'object') throw new Error('Invalid tone search request.')
  const r = input as Partial<ToneSearchRequest>
  if (typeof r.documentId !== 'string' || !r.documentId) throw new Error('documentId is required.')
  if (typeof r.tone !== 'string' || !r.tone.trim()) throw new Error('tone is required.')
  return {
    documentId: r.documentId,
    tone: r.tone.slice(0, 80),
    limit: typeof r.limit === 'number' ? r.limit : undefined
  }
}

export function registerToneIpc(): void {
  ipcMain.handle(IpcChannels.toneSearch, (_e, raw: unknown) => runToneSearch(validate(raw)))
}
