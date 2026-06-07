import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import {
  createEssay,
  deleteEssay,
  getEssay,
  listEssays,
  updateEssay,
  type EssayPatch
} from '../db/repositories/essayRepository'
import { draftEssayParagraph, generateEssayOutline } from '../services/essay/essayService'
import type {
  EssayDraftRequest,
  EssayOutline,
  EssayOutlineRequest,
  ThesisScope
} from '@shared/types/database'

const MAX_THESIS_CHARS = 2_000

function scopeOf(v: unknown): ThesisScope {
  return v === 'active' ? 'active' : 'library'
}

function validateOutlineRequest(input: unknown): EssayOutlineRequest {
  if (!input || typeof input !== 'object') throw new Error('Invalid outline request.')
  const r = input as Partial<EssayOutlineRequest>
  if (typeof r.thesis !== 'string' || !r.thesis.trim()) throw new Error('thesis is required.')
  const scope = scopeOf(r.scope)
  if (scope === 'active' && (typeof r.activeDocumentId !== 'string' || !r.activeDocumentId)) {
    throw new Error('activeDocumentId is required for active-scope outlines.')
  }
  return {
    thesis: r.thesis.slice(0, MAX_THESIS_CHARS),
    scope,
    activeDocumentId: typeof r.activeDocumentId === 'string' ? r.activeDocumentId : null
  }
}

function validateDraftRequest(input: unknown): EssayDraftRequest {
  if (!input || typeof input !== 'object') throw new Error('Invalid draft request.')
  const r = input as Partial<EssayDraftRequest>
  if (typeof r.thesis !== 'string') throw new Error('thesis is required.')
  if (!r.section || typeof r.section !== 'object') throw new Error('section is required.')
  const citationFormat = r.citationFormat ?? 'mla'
  return { thesis: r.thesis, section: r.section, citationFormat }
}

function sanitizePatch(input: unknown): EssayPatch {
  if (!input || typeof input !== 'object') throw new Error('Invalid essay patch.')
  const r = input as Record<string, unknown>
  const patch: EssayPatch = {}
  if (typeof r.title === 'string') patch.title = r.title.slice(0, 300)
  if (typeof r.thesis === 'string') patch.thesis = r.thesis.slice(0, MAX_THESIS_CHARS)
  if ('scope' in r) patch.scope = scopeOf(r.scope)
  if ('outline' in r) patch.outline = (r.outline as EssayOutline | null) ?? null
  if (typeof r.draftMd === 'string') patch.draftMd = r.draftMd
  return patch
}

export function registerEssayIpc(): void {
  ipcMain.handle(IpcChannels.essaysList, () => listEssays())

  ipcMain.handle(IpcChannels.essaysGet, (_e, id: unknown) => {
    if (typeof id !== 'string' || !id) throw new Error('id is required.')
    return getEssay(id)
  })

  ipcMain.handle(IpcChannels.essaysCreate, (_e, title: unknown, thesis: unknown, scope: unknown) => {
    const t = typeof title === 'string' && title.trim() ? title.slice(0, 300) : 'Untitled essay'
    return createEssay(t, typeof thesis === 'string' ? thesis.slice(0, MAX_THESIS_CHARS) : '', scopeOf(scope))
  })

  ipcMain.handle(IpcChannels.essaysUpdate, (_e, id: unknown, patch: unknown) => {
    if (typeof id !== 'string' || !id) throw new Error('id is required.')
    return updateEssay(id, sanitizePatch(patch))
  })

  ipcMain.handle(IpcChannels.essaysDelete, (_e, id: unknown) => {
    if (typeof id !== 'string' || !id) throw new Error('id is required.')
    deleteEssay(id)
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.essaysGenerateOutline, (_e, raw: unknown) =>
    generateEssayOutline(validateOutlineRequest(raw))
  )

  ipcMain.handle(IpcChannels.essaysDraftParagraph, (_e, raw: unknown) =>
    draftEssayParagraph(validateDraftRequest(raw))
  )
}
