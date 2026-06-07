import { create } from 'zustand'
import type { ChapterSummariesResult, DigestResult } from '@shared/types/summary'

// Drives the on-demand Digest (time-budgeted) + Chapter summaries (SparkNotes).
type Status = 'idle' | 'loading' | 'done' | 'error'

interface SummaryState {
  digestMinutes: number
  digestStatus: Status
  digest: DigestResult | null
  digestError: string | null

  chaptersStatus: Status
  chapters: ChapterSummariesResult | null
  chaptersError: string | null

  setDigestMinutes: (n: number) => void
  runDigest: (documentId: string) => Promise<void>
  runChapters: (documentId: string) => Promise<void>
}

let digestRun = 0
let chaptersRun = 0

export const useSummaryStore = create<SummaryState>((set) => ({
  digestMinutes: 10,
  digestStatus: 'idle',
  digest: null,
  digestError: null,
  chaptersStatus: 'idle',
  chapters: null,
  chaptersError: null,

  setDigestMinutes: (n) => set({ digestMinutes: n }),

  runDigest: async (documentId) => {
    const token = ++digestRun
    const minutes = useSummaryStore.getState().digestMinutes
    set({ digestStatus: 'loading', digestError: null })
    try {
      const digest = await window.fuzzy.summary.digest(documentId, minutes)
      if (token !== digestRun) return
      set({ digest, digestStatus: 'done' })
    } catch (err) {
      if (token !== digestRun) return
      set({ digestStatus: 'error', digestError: err instanceof Error ? err.message : 'Digest failed' })
    }
  },

  runChapters: async (documentId) => {
    const token = ++chaptersRun
    set({ chaptersStatus: 'loading', chaptersError: null })
    try {
      const chapters = await window.fuzzy.summary.chapters(documentId)
      if (token !== chaptersRun) return
      set({ chapters, chaptersStatus: 'done' })
    } catch (err) {
      if (token !== chaptersRun) return
      set({
        chaptersStatus: 'error',
        chaptersError: err instanceof Error ? err.message : 'Chapter summaries failed'
      })
    }
  }
}))
