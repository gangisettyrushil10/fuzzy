import { create } from 'zustand'
import type { StudyPackRecord } from '@shared/types/database'

interface StudyPackState {
  documentId: string | null
  pack: StudyPackRecord | null
  loading: boolean
  generating: boolean
  error: string | null

  loadFor: (documentId: string) => Promise<void>
  generateForActive: (documentId: string) => Promise<StudyPackRecord | null>
  clear: () => void
}

export const useStudyPackStore = create<StudyPackState>((set, get) => ({
  documentId: null,
  pack: null,
  loading: false,
  generating: false,
  error: null,

  loadFor: async (documentId) => {
    set({ documentId, loading: true, error: null, pack: null })
    try {
      const pack = await window.fuzzy.studyPacks.getLatest(documentId)
      if (get().documentId !== documentId) return
      set({ pack, loading: false })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load study pack'
      })
    }
  },

  generateForActive: async (documentId) => {
    set({ generating: true, error: null })
    try {
      const pack = await window.fuzzy.studyPacks.generate(documentId)
      set({ pack, generating: false, documentId })
      return pack
    } catch (err) {
      set({
        generating: false,
        error: err instanceof Error ? err.message : 'Failed to generate study pack'
      })
      return null
    }
  },

  clear: () => set({ documentId: null, pack: null, loading: false, generating: false, error: null })
}))
