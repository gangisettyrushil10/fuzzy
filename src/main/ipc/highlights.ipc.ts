import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import {
  HIGHLIGHT_SOURCE_KINDS,
  type CreateHighlightInput,
  type HighlightExportTarget,
  type HighlightSearchInput,
  type ReviewGrade,
  type UpdateHighlightInput
} from '@shared/types/database'
import {
  countDueHighlights,
  createHighlight,
  deleteHighlight,
  getHighlightStats,
  gradeHighlight,
  listDueHighlights,
  listHighlights,
  updateHighlight
} from '../db/repositories/highlightRepository'
import { saveTextFile } from '../services/fileService'
import {
  exportExtensionForTarget,
  exportHighlightsText,
  exportLabelForTarget
} from '../services/highlights/highlightExportService'
import { openHighlightImportDialog } from '../services/highlights/highlightImportService'

const REVIEW_GRADES: ReviewGrade[] = ['again', 'hard', 'good', 'easy']
const EXPORT_TARGETS: HighlightExportTarget[] = [
  'notion',
  'obsidian',
  'evernote',
  'roam',
  'logseq',
  'markdown',
  'csv',
  'json'
]

function sanitizeTags(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw.map((tag) => String(tag ?? ''))
}

function sanitizeSearchInput(raw: unknown): HighlightSearchInput {
  const r = (raw ?? {}) as Partial<HighlightSearchInput>
  return {
    query: typeof r.query === 'string' ? r.query : '',
    tags: sanitizeTags(r.tags) ?? [],
    favoritesOnly: Boolean(r.favoritesOnly),
    dueOnly: Boolean(r.dueOnly),
    sourceKinds: Array.isArray(r.sourceKinds)
      ? r.sourceKinds.filter((kind): kind is (typeof HIGHLIGHT_SOURCE_KINDS)[number] =>
          HIGHLIGHT_SOURCE_KINDS.includes(kind)
        )
      : [],
    limit: typeof r.limit === 'number' ? r.limit : undefined
  }
}

function sanitizeCreateInput(raw: unknown): CreateHighlightInput {
  const r = (raw ?? {}) as Partial<CreateHighlightInput>
  const sourceTitle = typeof r.sourceTitle === 'string' ? r.sourceTitle.trim() : ''
  const text = typeof r.text === 'string' ? r.text.trim() : ''
  if (!sourceTitle) throw new Error('sourceTitle is required.')
  if (!text) throw new Error('text is required.')
  return {
    sourceKind: 'manual',
    sourceLabel: 'Manual',
    contentKind: 'other',
    sourceTitle,
    sourceAuthor: typeof r.sourceAuthor === 'string' ? r.sourceAuthor : null,
    sourceUrl: typeof r.sourceUrl === 'string' ? r.sourceUrl : null,
    sourceLocation: typeof r.sourceLocation === 'string' ? r.sourceLocation : null,
    text,
    note: typeof r.note === 'string' ? r.note : '',
    tags: sanitizeTags(r.tags),
    isFavorite: Boolean(r.isFavorite)
  }
}

function sanitizeUpdateInput(raw: unknown): UpdateHighlightInput {
  const r = (raw ?? {}) as Partial<UpdateHighlightInput>
  const patch: UpdateHighlightInput = {}
  if (typeof r.sourceTitle === 'string') patch.sourceTitle = r.sourceTitle
  if (typeof r.sourceAuthor === 'string' || r.sourceAuthor === null) patch.sourceAuthor = r.sourceAuthor
  if (typeof r.sourceUrl === 'string' || r.sourceUrl === null) patch.sourceUrl = r.sourceUrl
  if (typeof r.sourceLocation === 'string' || r.sourceLocation === null) {
    patch.sourceLocation = r.sourceLocation
  }
  if (typeof r.text === 'string') patch.text = r.text
  if (typeof r.note === 'string') patch.note = r.note
  if (Array.isArray(r.tags)) patch.tags = sanitizeTags(r.tags)
  if (typeof r.isFavorite === 'boolean') patch.isFavorite = r.isFavorite
  return patch
}

function sanitizeExportTarget(raw: unknown): HighlightExportTarget {
  if (EXPORT_TARGETS.includes(raw as HighlightExportTarget)) {
    return raw as HighlightExportTarget
  }
  return 'markdown'
}

export function registerHighlightsIpc(): void {
  ipcMain.handle(IpcChannels.highlightsList, (_e, rawFilters: unknown) =>
    listHighlights(sanitizeSearchInput(rawFilters))
  )

  ipcMain.handle(IpcChannels.highlightsImport, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return openHighlightImportDialog(win)
  })

  ipcMain.handle(IpcChannels.highlightsCreate, (_e, raw: unknown) =>
    createHighlight(sanitizeCreateInput(raw))
  )

  ipcMain.handle(IpcChannels.highlightsUpdate, (_e, id: unknown, rawPatch: unknown) => {
    if (typeof id !== 'string' || !id) throw new Error('id is required.')
    return updateHighlight(id, sanitizeUpdateInput(rawPatch))
  })

  ipcMain.handle(IpcChannels.highlightsDelete, (_e, id: unknown) => {
    if (typeof id !== 'string' || !id) throw new Error('id is required.')
    deleteHighlight(id)
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.highlightsGrade, (_e, id: unknown, grade: unknown) => {
    if (typeof id !== 'string' || !id) throw new Error('id is required.')
    const safeGrade = REVIEW_GRADES.includes(grade as ReviewGrade) ? (grade as ReviewGrade) : 'good'
    return gradeHighlight(id, safeGrade)
  })

  ipcMain.handle(IpcChannels.highlightsDue, (_e, rawLimit: unknown) => {
    const limit = typeof rawLimit === 'number' ? rawLimit : 30
    return listDueHighlights(new Date().toISOString(), limit)
  })

  ipcMain.handle(IpcChannels.highlightsDueCount, () => {
    return countDueHighlights(new Date().toISOString())
  })

  ipcMain.handle(IpcChannels.highlightsStats, () => {
    return getHighlightStats(new Date().toISOString())
  })

  ipcMain.handle(
    IpcChannels.highlightsExportText,
    (_e, rawTarget: unknown, rawFilters: unknown) => {
      const target = sanitizeExportTarget(rawTarget)
      const highlights = listHighlights({
        ...sanitizeSearchInput(rawFilters),
        limit: 1000
      })
      return exportHighlightsText(highlights, target)
    }
  )

  ipcMain.handle(
    IpcChannels.highlightsExportFile,
    async (event, rawTarget: unknown, rawFilters: unknown) => {
      const target = sanitizeExportTarget(rawTarget)
      const highlights = listHighlights({
        ...sanitizeSearchInput(rawFilters),
        limit: 1000
      })
      const content = exportHighlightsText(highlights, target)
      const defaultName = `fuzzy-highlights-${target}.${exportExtensionForTarget(target)}`
      const win = BrowserWindow.fromWebContents(event.sender)
      return saveTextFile(win, {
        defaultName,
        content,
        filters: [
          {
            name: exportLabelForTarget(target),
            extensions: [exportExtensionForTarget(target)]
          }
        ]
      })
    }
  )
}
