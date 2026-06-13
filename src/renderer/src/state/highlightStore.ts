import { create } from 'zustand'
import type {
  HighlightExportTarget,
  HighlightRecord,
  HighlightSearchInput,
  HighlightStats,
  ReviewGrade
} from '@shared/types/database'
import { toast } from './toastStore'

interface HighlightState {
  items: HighlightRecord[]
  dueItems: HighlightRecord[]
  stats: HighlightStats | null
  filters: HighlightSearchInput
  loading: boolean
  dueLoading: boolean
  statsLoading: boolean
  importing: boolean
  error: string | null

  load: (patch?: Partial<HighlightSearchInput>) => Promise<void>
  loadDue: (limit?: number) => Promise<void>
  loadStats: () => Promise<void>
  importHighlights: () => Promise<void>
  createManual: (input: {
    sourceTitle: string
    text: string
    note?: string
    tags?: string[]
    sourceAuthor?: string | null
    sourceUrl?: string | null
    sourceLocation?: string | null
  }) => Promise<void>
  updateHighlight: (
    id: string,
    patch: {
      sourceTitle?: string
      sourceAuthor?: string | null
      sourceUrl?: string | null
      sourceLocation?: string | null
      text?: string
      note?: string
      tags?: string[]
      isFavorite?: boolean
    }
  ) => Promise<void>
  deleteHighlight: (id: string) => Promise<void>
  gradeHighlight: (id: string, grade: ReviewGrade) => Promise<void>
  exportHighlights: (target: HighlightExportTarget) => Promise<void>
}

function mergeFilters(
  current: HighlightSearchInput,
  patch: Partial<HighlightSearchInput> | undefined
): HighlightSearchInput {
  if (!patch) return current
  return { ...current, ...patch }
}

function replaceItem(items: HighlightRecord[], next: HighlightRecord): HighlightRecord[] {
  return items.map((item) => (item.id === next.id ? next : item))
}

export const useHighlightStore = create<HighlightState>((set, get) => ({
  items: [],
  dueItems: [],
  stats: null,
  filters: {
    query: '',
    tags: [],
    favoritesOnly: false,
    dueOnly: false,
    sourceKinds: [],
    limit: 200
  },
  loading: false,
  dueLoading: false,
  statsLoading: false,
  importing: false,
  error: null,

  load: async (patch) => {
    const filters = mergeFilters(get().filters, patch)
    set({ loading: true, error: null, filters })
    try {
      const items = await window.fuzzy.highlights.list(filters)
      set({ items, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load highlights'
      })
    }
  },

  loadDue: async (limit = 20) => {
    set({ dueLoading: true })
    try {
      const dueItems = await window.fuzzy.highlights.due(limit)
      set({ dueItems, dueLoading: false })
    } catch (error) {
      set({
        dueLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load daily review'
      })
    }
  },

  loadStats: async () => {
    set({ statsLoading: true })
    try {
      const stats = await window.fuzzy.highlights.stats()
      set({ stats, statsLoading: false })
    } catch (error) {
      set({
        statsLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load highlight stats'
      })
    }
  },

  importHighlights: async () => {
    set({ importing: true, error: null })
    try {
      const result = await window.fuzzy.highlights.import()
      if (!result) {
        set({ importing: false })
        return
      }
      await Promise.all([get().load(), get().loadDue(), get().loadStats()])
      set({ importing: false })
      toast.success(
        result.dedupedCount > 0
          ? `Imported ${result.importedCount} highlights from ${result.sourceLabel} (${result.dedupedCount} already existed)`
          : `Imported ${result.importedCount} highlights from ${result.sourceLabel}`
      )
    } catch (error) {
      set({
        importing: false,
        error: error instanceof Error ? error.message : 'Import failed'
      })
      toast.error(error instanceof Error ? error.message : 'Import failed')
    }
  },

  createManual: async (input) => {
    try {
      await window.fuzzy.highlights.create(input)
      await Promise.all([get().load(), get().loadDue(), get().loadStats()])
      toast.success('Highlight saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save highlight')
    }
  },

  updateHighlight: async (id, patch) => {
    try {
      const next = await window.fuzzy.highlights.update(id, patch)
      if (!next) return
      set({
        items: replaceItem(get().items, next),
        dueItems: replaceItem(get().dueItems, next)
      })
      void get().loadStats()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update highlight')
    }
  },

  deleteHighlight: async (id) => {
    try {
      await window.fuzzy.highlights.delete(id)
      set({
        items: get().items.filter((item) => item.id !== id),
        dueItems: get().dueItems.filter((item) => item.id !== id)
      })
      void get().loadStats()
      toast.success('Highlight deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete highlight')
    }
  },

  gradeHighlight: async (id, grade) => {
    try {
      const next = await window.fuzzy.highlights.grade(id, grade)
      if (!next) return
      set({
        items: replaceItem(get().items, next),
        dueItems: get().dueItems.filter((item) => item.id !== id)
      })
      await get().loadStats()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not grade highlight')
    }
  },

  exportHighlights: async (target) => {
    try {
      const result = await window.fuzzy.highlights.exportFile(target, get().filters)
      if (result.ok) {
        toast.success(`Exported highlights to ${result.filePath ?? 'file'}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed')
    }
  }
}))
