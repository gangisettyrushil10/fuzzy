import { create } from 'zustand'
import type { ReadingSessionRecord } from '@shared/types/database'

interface ReadingSessionState {
  documentId: string | null
  session: ReadingSessionRecord | null
  loading: boolean
  generating: boolean
  error: string | null
  // Wall-clock time the session was started in the renderer (ms epoch).
  // Used to drive the elapsed-minutes badge in the bottom bar.
  startedAt: number | null

  loadFor: (documentId: string) => Promise<void>
  createForActive: (
    documentId: string,
    availableMinutes: number
  ) => Promise<ReadingSessionRecord | null>
  startSession: () => void
  clear: () => void
}

export const useReadingSessionStore = create<ReadingSessionState>((set, get) => ({
  documentId: null,
  session: null,
  loading: false,
  generating: false,
  error: null,
  startedAt: null,

  loadFor: async (documentId) => {
    set({ documentId, loading: true, error: null, session: null, startedAt: null })
    try {
      const session = await window.fuzzy.readingSessions.getLatest(documentId)
      // Drop the result if the user already switched away.
      if (get().documentId !== documentId) return
      set({ session, loading: false })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load reading session'
      })
    }
  },

  createForActive: async (documentId, availableMinutes) => {
    set({ generating: true, error: null })
    try {
      const session = await window.fuzzy.readingSessions.create(documentId, availableMinutes)
      set({ session, generating: false, startedAt: Date.now(), documentId })
      return session
    } catch (err) {
      set({
        generating: false,
        error: err instanceof Error ? err.message : 'Failed to create reading session'
      })
      return null
    }
  },

  startSession: () => set({ startedAt: Date.now() }),

  clear: () =>
    set({
      documentId: null,
      session: null,
      loading: false,
      generating: false,
      error: null,
      startedAt: null
    })
}))
