import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import {
  addEvidence,
  addNote,
  addSynthesis,
  createProject,
  deleteProject,
  getProjectDetail,
  listProjects,
  removeEvidence,
  removeNote,
  removeSynthesis,
  updateNote,
  updateProject
} from '../db/repositories/projectRepository'
import { exportProject } from '../services/export/exportService'
import type {
  CitationFormat,
  ExportFormat,
  RankedPassage,
  SynthesisResult
} from '@shared/types/database'

function reqString(value: unknown, name: string, max = 5_000): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required.`)
  return value.slice(0, max)
}

export function registerProjectsIpc(): void {
  ipcMain.handle(IpcChannels.projectsList, () => listProjects())

  ipcMain.handle(IpcChannels.projectsCreate, (_e, title: unknown, thesis: unknown) =>
    createProject(reqString(title, 'title', 200), typeof thesis === 'string' ? thesis.slice(0, 2000) : '')
  )

  ipcMain.handle(IpcChannels.projectsUpdate, (_e, id: unknown, patch: unknown) => {
    const p = (patch ?? {}) as { title?: unknown; thesis?: unknown }
    return updateProject(reqString(id, 'id'), {
      title: typeof p.title === 'string' ? p.title.slice(0, 200) : undefined,
      thesis: typeof p.thesis === 'string' ? p.thesis.slice(0, 2000) : undefined
    })
  })

  ipcMain.handle(IpcChannels.projectsDelete, (_e, id: unknown) => {
    deleteProject(reqString(id, 'id'))
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.projectsGetDetail, (_e, id: unknown) =>
    getProjectDetail(reqString(id, 'id'))
  )

  ipcMain.handle(IpcChannels.projectsAddEvidence, (_e, projectId: unknown, passage: unknown) => {
    if (!passage || typeof passage !== 'object') throw new Error('passage is required.')
    return addEvidence(reqString(projectId, 'projectId'), passage as RankedPassage)
  })

  ipcMain.handle(IpcChannels.projectsRemoveEvidence, (_e, id: unknown) => {
    removeEvidence(reqString(id, 'id'))
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.projectsAddNote, (_e, projectId: unknown, content: unknown) =>
    addNote(reqString(projectId, 'projectId'), reqString(content, 'content', 20_000))
  )

  ipcMain.handle(IpcChannels.projectsUpdateNote, (_e, id: unknown, content: unknown) => {
    updateNote(reqString(id, 'id'), reqString(content, 'content', 20_000))
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.projectsRemoveNote, (_e, id: unknown) => {
    removeNote(reqString(id, 'id'))
    return { ok: true as const }
  })

  ipcMain.handle(
    IpcChannels.projectsAddSynthesis,
    (_e, projectId: unknown, thesis: unknown, result: unknown) => {
      if (!result || typeof result !== 'object') throw new Error('result is required.')
      return addSynthesis(
        reqString(projectId, 'projectId'),
        reqString(thesis, 'thesis', 2000),
        result as SynthesisResult
      )
    }
  )

  ipcMain.handle(IpcChannels.projectsRemoveSynthesis, (_e, id: unknown) => {
    removeSynthesis(reqString(id, 'id'))
    return { ok: true as const }
  })

  ipcMain.handle(
    IpcChannels.projectsExport,
    (_e, id: unknown, format: unknown, exportFormat: unknown) => {
      const detail = getProjectDetail(reqString(id, 'id'))
      if (!detail) throw new Error('Project not found.')
      const fmt: CitationFormat = (['mla', 'apa', 'chicago', 'harvard'] as CitationFormat[]).includes(
        format as CitationFormat
      )
        ? (format as CitationFormat)
        : 'mla'
      const ex: ExportFormat = exportFormat === 'html' ? 'html' : 'markdown'
      return exportProject(detail, fmt, ex)
    }
  )
}
