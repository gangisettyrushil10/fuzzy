import { create } from 'zustand'
import type { EvidenceItem, EvidenceSearchResult } from '@shared/types/database'
import { useDocumentStore } from './documentStore'
import { usePdfStore } from './pdfStore'
import { useAppUiStore } from './appUiStore'

// Evidence search: inferential, document-scoped claim/evidence queries ("find
// evidence that two characters are in love"). Retrieval + entity resolution are
// real; the LLM only judges and organizes; citations are re-attached from real
// passages. Same staged "analyzing" delay as the Thesis Workspace.

type EvidenceStatus = 'idle' | 'analyzing' | 'done' | 'error'

interface EvidenceState {
  query: string
  status: EvidenceStatus
  result: EvidenceSearchResult | null
  error: string | null

  setQuery: (query: string) => void
  runSearch: () => Promise<void>
  showInPage: (item: EvidenceItem) => void
  reset: () => void
}

const MIN_ANALYZE_MS = 500
let runCounter = 0
let activeRun = 0

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export const useEvidenceStore = create<EvidenceState>((set, get) => ({
  query: '',
  status: 'idle',
  result: null,
  error: null,

  setQuery: (query) => set({ query }),

  runSearch: async () => {
    const { query } = get()
    if (!query.trim()) return
    const documentId = useDocumentStore.getState().activeDocumentId
    if (!documentId) {
      set({ status: 'error', error: 'Open a document first to search it for evidence.' })
      return
    }
    const token = ++runCounter
    activeRun = token
    set({ status: 'analyzing', error: null })
    try {
      const [result] = await Promise.all([
        window.fuzzy.evidence.search({ query, documentId, limit: 16 }),
        delay(MIN_ANALYZE_MS)
      ])
      if (activeRun !== token) return
      set({ status: 'done', result })
    } catch (err) {
      if (activeRun !== token) return
      set({ status: 'error', error: err instanceof Error ? err.message : 'Evidence search failed' })
    }
  },

  // Reuse the Thesis jump-to-source contract: switch document, turn the page,
  // and project the snippet onto it (PDF rects via word geometry; reflowable via
  // word-sequence find + scrollIntoView).
  showInPage: (item) => {
    const docStore = useDocumentStore.getState()
    if (docStore.activeDocumentId !== item.documentId) {
      docStore.setActiveDocument(item.documentId)
    }
    usePdfStore.getState().setPage(item.pageNumber)
    useAppUiStore.getState().requestPassageHighlight({
      documentId: item.documentId,
      pageNumber: item.pageNumber,
      snippet: item.snippet
    })
  },

  reset: () => set({ status: 'idle', result: null, error: null })
}))
