import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import {
  getDocMetadata,
  updateDocumentMetadata
} from '../db/repositories/documentRepository'
import { runThesisSearch } from '../services/thesis/thesisSearchService'
import type { DocMetadata, ThesisSearchRequest } from '@shared/types/database'

const MAX_THESIS_CHARS = 2_000

function validateSearchRequest(input: unknown): ThesisSearchRequest {
  if (!input || typeof input !== 'object') throw new Error('Invalid thesis search request.')
  const r = input as Partial<ThesisSearchRequest>
  if (typeof r.thesis !== 'string' || !r.thesis.trim()) {
    throw new Error('thesis is required.')
  }
  const scope = r.scope === 'active' ? 'active' : 'library'
  if (scope === 'active' && (typeof r.activeDocumentId !== 'string' || !r.activeDocumentId)) {
    throw new Error('activeDocumentId is required for active-scope search.')
  }
  return {
    thesis: r.thesis.slice(0, MAX_THESIS_CHARS),
    scope,
    activeDocumentId: typeof r.activeDocumentId === 'string' ? r.activeDocumentId : null,
    limit: typeof r.limit === 'number' ? r.limit : undefined
  }
}

// Sanitize a metadata patch from the renderer: only the four citation fields,
// strings trimmed/capped, year coerced to a sane integer or null.
function sanitizeMetadataPatch(input: unknown): Partial<DocMetadata> {
  if (!input || typeof input !== 'object') throw new Error('Invalid metadata patch.')
  const r = input as Record<string, unknown>
  const patch: Partial<DocMetadata> = {}
  const str = (v: unknown): string | null => {
    if (typeof v !== 'string') return null
    const t = v.trim()
    return t ? t.slice(0, 300) : null
  }
  if ('author' in r) patch.author = str(r.author)
  if ('publisher' in r) patch.publisher = str(r.publisher)
  if ('sourceUrl' in r) patch.sourceUrl = str(r.sourceUrl)
  if ('year' in r) {
    const n = typeof r.year === 'number' ? r.year : Number.parseInt(String(r.year ?? ''), 10)
    patch.year = Number.isFinite(n) && n >= 0 && n <= 3000 ? Math.trunc(n) : null
  }
  return patch
}

export function registerThesisIpc(): void {
  ipcMain.handle(IpcChannels.thesisSearch, (_e, raw: unknown) => {
    const request = validateSearchRequest(raw)
    return runThesisSearch(request)
  })

  ipcMain.handle(IpcChannels.documentsGetMetadata, (_e, documentId: unknown) => {
    if (typeof documentId !== 'string' || !documentId) throw new Error('documentId is required.')
    return getDocMetadata(documentId)
  })

  ipcMain.handle(IpcChannels.documentsUpdateMetadata, (_e, documentId: unknown, patch: unknown) => {
    if (typeof documentId !== 'string' || !documentId) throw new Error('documentId is required.')
    return updateDocumentMetadata(documentId, sanitizeMetadataPatch(patch))
  })
}
