import { create } from 'zustand'
import type { AnnotationRecord } from '@shared/types/database'

interface AnnotationState {
  documentId: string | null
  annotations: AnnotationRecord[]
  loading: boolean
  error: string | null

  loadFor: (documentId: string) => Promise<void>
  add: (annotation: AnnotationRecord) => void
  remove: (id: string) => Promise<void>
  clear: () => void
}

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  documentId: null,
  annotations: [],
  loading: false,
  error: null,

  loadFor: async (documentId) => {
    set({ documentId, loading: true, error: null, annotations: [] })
    try {
      const list = await window.fuzzy.annotations.listForDocument(documentId)
      // If a different doc was switched in mid-flight, drop the result.
      if (get().documentId !== documentId) return
      set({ annotations: list, loading: false })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load notes'
      })
    }
  },

  add: (annotation) => {
    if (annotation.documentId !== get().documentId) return
    set({ annotations: [annotation, ...get().annotations] })
  },

  remove: async (id) => {
    await window.fuzzy.annotations.delete(id)
    set({ annotations: get().annotations.filter((a) => a.id !== id) })
  },

  clear: () => set({ documentId: null, annotations: [], error: null })
}))
