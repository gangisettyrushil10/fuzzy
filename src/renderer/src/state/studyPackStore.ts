import { create } from 'zustand'
import type {
  QuizAttemptStats,
  StudyPackOptions,
  StudyPackRecord
} from '@shared/types/database'

interface StudyPackState {
  documentId: string | null
  // The currently displayed pack (selectable from history).
  pack: StudyPackRecord | null
  // All packs for the active document, newest first (history switcher).
  packs: StudyPackRecord[]
  attemptStats: QuizAttemptStats | null
  loading: boolean
  generating: boolean
  error: string | null
  // The pre-generation options modal.
  optionsModalOpen: boolean

  loadFor: (documentId: string) => Promise<void>
  generate: (documentId: string, options: StudyPackOptions) => Promise<StudyPackRecord | null>
  selectPack: (id: string) => void
  deletePack: (id: string) => Promise<void>
  refreshStats: (documentId: string) => Promise<void>
  openOptions: () => void
  closeOptions: () => void
  clear: () => void
}

export const useStudyPackStore = create<StudyPackState>((set, get) => ({
  documentId: null,
  pack: null,
  packs: [],
  attemptStats: null,
  loading: false,
  generating: false,
  error: null,
  optionsModalOpen: false,

  loadFor: async (documentId) => {
    set({ documentId, loading: true, error: null, pack: null, packs: [], attemptStats: null })
    try {
      const [packs, attemptStats] = await Promise.all([
        window.fuzzy.studyPacks.list(documentId),
        window.fuzzy.quizAttempts.stats(documentId)
      ])
      if (get().documentId !== documentId) return
      set({ packs, pack: packs[0] ?? null, attemptStats, loading: false })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load study pack'
      })
    }
  },

  generate: async (documentId, options) => {
    set({ generating: true, error: null })
    try {
      const pack = await window.fuzzy.studyPacks.generate(documentId, options)
      set((s) => ({
        pack,
        packs: [pack, ...s.packs.filter((p) => p.id !== pack.id)],
        generating: false,
        documentId
      }))
      return pack
    } catch (err) {
      set({
        generating: false,
        error: err instanceof Error ? err.message : 'Failed to generate study pack'
      })
      return null
    }
  },

  selectPack: (id) => {
    const match = get().packs.find((p) => p.id === id)
    if (match) set({ pack: match })
  },

  deletePack: async (id) => {
    try {
      await window.fuzzy.studyPacks.delete(id)
      set((s) => {
        const packs = s.packs.filter((p) => p.id !== id)
        const pack = s.pack?.id === id ? (packs[0] ?? null) : s.pack
        return { packs, pack }
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete study pack' })
    }
  },

  refreshStats: async (documentId) => {
    try {
      const attemptStats = await window.fuzzy.quizAttempts.stats(documentId)
      if (get().documentId === documentId) set({ attemptStats })
    } catch {
      /* non-fatal */
    }
  },

  openOptions: () => set({ optionsModalOpen: true }),
  closeOptions: () => set({ optionsModalOpen: false }),

  clear: () =>
    set({
      documentId: null,
      pack: null,
      packs: [],
      attemptStats: null,
      loading: false,
      generating: false,
      error: null,
      optionsModalOpen: false
    })
}))
