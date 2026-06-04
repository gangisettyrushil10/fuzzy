import { create } from 'zustand'
import type { DocumentRecord } from '@shared/types/database'

interface DocumentState {
  documents: DocumentRecord[]
  activeDocumentId: string | null
  loaded: boolean
  loading: boolean
  importing: boolean
  error: string | null

  refresh: () => Promise<void>
  // Pulls the documents list AND the persisted last-active id, then sets
  // activeDocumentId to that id if the row still exists.
  bootstrap: () => Promise<void>
  setActiveDocument: (id: string | null) => void
  seedDevDocument: () => Promise<void>
  importDocument: () => Promise<DocumentRecord | null>
  importSampleDocument: () => Promise<DocumentRecord | null>
  deleteDocument: (id: string) => Promise<void>
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  activeDocumentId: null,
  loaded: false,
  loading: false,
  importing: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null })
    try {
      const documents = await window.fuzzy.documents.list()
      set({ documents, loaded: true, loading: false })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load documents'
      })
    }
  },

  bootstrap: async () => {
    set({ loading: true, error: null })
    try {
      const [documents, settings] = await Promise.all([
        window.fuzzy.documents.list(),
        window.fuzzy.settings.get()
      ])
      const lastId = settings.lastActiveDocumentId
      const restored = lastId && documents.some((d) => d.id === lastId) ? lastId : null
      set({
        documents,
        loaded: true,
        loading: false,
        activeDocumentId: restored
      })
      if (restored) {
        window.fuzzy.documents.touch(restored).catch(() => undefined)
      } else if (lastId) {
        // The previously open document is gone — clear the pointer so we
        // don't keep trying to restore a stale id.
        window.fuzzy.settings.setLastActiveDocumentId(null).catch(() => undefined)
      }
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to bootstrap'
      })
    }
  },

  setActiveDocument: (id) => {
    set({ activeDocumentId: id })
    window.fuzzy.settings
      .setLastActiveDocumentId(id ?? null)
      .catch((err) => console.error('[fuzzy] persist lastActiveDocumentId failed', err))
    if (id) {
      window.fuzzy.documents.touch(id).catch((err) => {
        console.error('[fuzzy] touch document failed', err)
      })
    }
  },

  seedDevDocument: async () => {
    if (!window.fuzzy.dev) return
    await window.fuzzy.dev.seedDocument()
    await get().refresh()
  },

  importSampleDocument: async () => {
    set({ importing: true, error: null })
    try {
      const result = await window.fuzzy.documents.importSample()
      if (!result) {
        set({ importing: false })
        return null
      }
      await get().refresh()
      set({ activeDocumentId: result.document.id, importing: false })
      window.fuzzy.documents.touch(result.document.id).catch(() => undefined)
      window.fuzzy.settings.setLastActiveDocumentId(result.document.id).catch(() => undefined)
      return result.document
    } catch (err) {
      set({
        importing: false,
        error: err instanceof Error ? err.message : 'Sample import failed'
      })
      return null
    }
  },

  importDocument: async () => {
    set({ importing: true, error: null })
    try {
      const result = await window.fuzzy.documents.import()
      if (!result) {
        set({ importing: false })
        return null
      }
      await get().refresh()
      set({ activeDocumentId: result.document.id, importing: false })
      window.fuzzy.documents.touch(result.document.id).catch(() => undefined)
      window.fuzzy.settings.setLastActiveDocumentId(result.document.id).catch(() => undefined)
      return result.document
    } catch (err) {
      set({
        importing: false,
        error: err instanceof Error ? err.message : 'Import failed'
      })
      return null
    }
  },

  deleteDocument: async (id) => {
    await window.fuzzy.documents.delete(id)
    if (get().activeDocumentId === id) {
      set({ activeDocumentId: null })
      window.fuzzy.settings.setLastActiveDocumentId(null).catch(() => undefined)
    }
    await get().refresh()
  }
}))
