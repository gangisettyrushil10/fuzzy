import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import { runEvidenceSearch } from '../services/evidence/evidenceSearchService'
import { getMentionPages, listEntities } from '../db/repositories/entityRepository'
import { rebuildEntityIndex } from '../services/entities/entityIndexService'
import type { EvidenceSearchRequest } from '@shared/types/database'

const MAX_QUERY_CHARS = 500

function validateEvidenceRequest(input: unknown): EvidenceSearchRequest {
  if (!input || typeof input !== 'object') throw new Error('Invalid evidence search request.')
  const r = input as Partial<EvidenceSearchRequest>
  if (typeof r.query !== 'string' || !r.query.trim()) throw new Error('query is required.')
  if (typeof r.documentId !== 'string' || !r.documentId) throw new Error('documentId is required.')
  const entityIds = Array.isArray(r.entityIds)
    ? r.entityIds.filter((id): id is string => typeof id === 'string')
    : null
  return {
    query: r.query.slice(0, MAX_QUERY_CHARS),
    documentId: r.documentId,
    entityIds,
    limit: typeof r.limit === 'number' ? r.limit : undefined
  }
}

export function registerEvidenceIpc(): void {
  ipcMain.handle(IpcChannels.evidenceSearch, (_e, raw: unknown) => {
    const request = validateEvidenceRequest(raw)
    return runEvidenceSearch(request)
  })

  ipcMain.handle(IpcChannels.entitiesList, (_e, documentId: unknown) => {
    if (typeof documentId !== 'string' || !documentId) throw new Error('documentId is required.')
    return listEntities(documentId, 'character')
  })

  ipcMain.handle(IpcChannels.entitiesMentions, (_e, entityId: unknown) => {
    if (typeof entityId !== 'string' || !entityId) throw new Error('entityId is required.')
    return getMentionPages(entityId)
  })

  ipcMain.handle(IpcChannels.entitiesRebuild, (_e, documentId: unknown) => {
    if (typeof documentId !== 'string' || !documentId) throw new Error('documentId is required.')
    return rebuildEntityIndex(documentId)
  })
}
