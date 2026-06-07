import { create } from 'zustand'
import type { ToneMatch, ToneSearchResult } from '@shared/types/database'
import { useDocumentStore } from './documentStore'
import { usePdfStore } from './pdfStore'
import { useAppUiStore } from './appUiStore'

// "Ctrl-F for tone": local affect-lexicon ranking of the active document's
// passages by mood. Fully local (no API), so results are instant; we still stage
// a short delay for a considered feel.

type ToneStatus = 'idle' | 'analyzing' | 'done' | 'error'

interface ToneState {
  tone: string
  status: ToneStatus
  result: ToneSearchResult | null
  error: string | null

  setTone: (tone: string) => void
  runSearch: (tone?: string) => Promise<void>
  showInPage: (match: ToneMatch) => void
  reset: () => void
}

const MIN_ANALYZE_MS = 300
let runCounter = 0
let activeRun = 0
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export const useToneStore = create<ToneState>((set, get) => ({
  tone: '',
  status: 'idle',
  result: null,
  error: null,

  setTone: (tone) => set({ tone }),

  runSearch: async (toneArg) => {
    const tone = (toneArg ?? get().tone).trim()
    if (toneArg) set({ tone })
    if (!tone) return
    const documentId = useDocumentStore.getState().activeDocumentId
    if (!documentId) {
      set({ status: 'error', error: 'Open a document first to search it for a tone.' })
      return
    }
    const token = ++runCounter
    activeRun = token
    set({ status: 'analyzing', error: null })
    try {
      const [result] = await Promise.all([
        window.fuzzy.tone.search({ documentId, tone, limit: 20 }),
        delay(MIN_ANALYZE_MS)
      ])
      if (activeRun !== token) return
      set({ status: 'done', result })
    } catch (err) {
      if (activeRun !== token) return
      set({ status: 'error', error: err instanceof Error ? err.message : 'Tone search failed' })
    }
  },

  showInPage: (match) => {
    const docStore = useDocumentStore.getState()
    if (docStore.activeDocumentId !== match.documentId) docStore.setActiveDocument(match.documentId)
    usePdfStore.getState().setPage(match.pageNumber)
    useAppUiStore.getState().requestPassageHighlight({
      documentId: match.documentId,
      pageNumber: match.pageNumber,
      snippet: match.snippet
    })
  },

  reset: () => set({ status: 'idle', result: null, error: null })
}))
