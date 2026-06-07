import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import { generateSynthesis } from '../services/synthesis/synthesisService'
import type { SynthesisRequest } from '@shared/types/database'

const MAX_THESIS_CHARS = 2_000

function validate(input: unknown): SynthesisRequest {
  if (!input || typeof input !== 'object') throw new Error('Invalid synthesis request.')
  const r = input as Partial<SynthesisRequest>
  if (typeof r.thesis !== 'string' || !r.thesis.trim()) throw new Error('thesis is required.')
  const scope = r.scope === 'active' ? 'active' : 'library'
  if (scope === 'active' && (typeof r.activeDocumentId !== 'string' || !r.activeDocumentId)) {
    throw new Error('activeDocumentId is required for active-scope synthesis.')
  }
  return {
    thesis: r.thesis.slice(0, MAX_THESIS_CHARS),
    scope,
    activeDocumentId: typeof r.activeDocumentId === 'string' ? r.activeDocumentId : null
  }
}

export function registerSynthesisIpc(): void {
  ipcMain.handle(IpcChannels.synthesisGenerate, (_e, raw: unknown) => generateSynthesis(validate(raw)))
}
