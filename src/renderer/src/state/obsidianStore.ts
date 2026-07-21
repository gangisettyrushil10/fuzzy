import { create } from 'zustand'
import type { ObsidianStatus } from '@shared/types/api'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface ObsidianState {
  status: ObsidianStatus | null
  documentId: string | null
  content: string
  loading: boolean
  saveState: SaveState
  error: string | null

  loadStatus: () => Promise<void>
  pickVault: () => Promise<void>
  clearVault: () => Promise<void>
  loadFor: (documentId: string) => Promise<void>
  setContent: (text: string) => void
  save: () => Promise<void>
  clear: () => void
}

export const useObsidianStore = create<ObsidianState>((set, get) => ({
  status: null,
  documentId: null,
  content: '',
  loading: false,
  saveState: 'idle',
  error: null,

  loadStatus: async () => {
    try {
      const status = await window.fuzzy.obsidian.getStatus()
      set({ status })
      // If a document is already active, (re)load its note now that we know
      // whether a vault is connected.
      const { documentId } = get()
      if (documentId) get().loadFor(documentId)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to read Obsidian status' })
    }
  },

  pickVault: async () => {
    const status = await window.fuzzy.obsidian.pickVault()
    set({ status })
    const { documentId } = get()
    if (documentId) get().loadFor(documentId)
  },

  clearVault: async () => {
    const status = await window.fuzzy.obsidian.clearVault()
    set({ status, content: '', saveState: 'idle' })
  },

  loadFor: async (documentId) => {
    set({ documentId, content: '', saveState: 'idle', error: null })
    if (!get().status?.connected) return
    set({ loading: true })
    try {
      const content = await window.fuzzy.obsidian.readNote(documentId)
      // A different doc switched in mid-flight — drop this result.
      if (get().documentId !== documentId) return
      set({ content, loading: false })
    } catch (err) {
      if (get().documentId !== documentId) return
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to load note' })
    }
  },

  setContent: (text) => set({ content: text, saveState: 'saving' }),

  save: async () => {
    const { documentId, content, status } = get()
    if (!documentId || !status?.connected) return
    try {
      await window.fuzzy.obsidian.writeNote(documentId, content)
      // Only flip to "saved" if no newer edit arrived while we were writing.
      if (get().documentId === documentId && get().content === content) {
        set({ saveState: 'saved' })
      }
    } catch (err) {
      set({ saveState: 'error', error: err instanceof Error ? err.message : 'Failed to save note' })
    }
  },

  clear: () => set({ documentId: null, content: '', saveState: 'idle', error: null })
}))
