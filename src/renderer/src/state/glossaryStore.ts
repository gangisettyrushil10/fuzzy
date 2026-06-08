import { create } from 'zustand'
import type { GlossaryResult, GlossaryTerm } from '@shared/types/database'
import { useDocumentStore } from './documentStore'
import { usePdfStore } from './pdfStore'
import { useAppUiStore } from './appUiStore'

// Key Terms Glossary: extract the active document's defined terms with plain
// definitions + verbatim, cited source quotes. Doc-scoped, on-demand.

type GlossaryStatus = 'idle' | 'analyzing' | 'done' | 'error'

interface GlossaryState {
  status: GlossaryStatus
  result: GlossaryResult | null
  error: string | null
  filter: string

  setFilter: (q: string) => void
  build: () => Promise<void>
  showTerm: (term: GlossaryTerm) => void
  reset: () => void
}

const MIN_ANALYZE_MS = 400
let runCounter = 0
let activeRun = 0
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export const useGlossaryStore = create<GlossaryState>((set) => ({
  status: 'idle',
  result: null,
  error: null,
  filter: '',

  setFilter: (filter) => set({ filter }),

  build: async () => {
    const documentId = useDocumentStore.getState().activeDocumentId
    if (!documentId) {
      set({ status: 'error', error: 'Open a document first to build its glossary.' })
      return
    }
    const token = ++runCounter
    activeRun = token
    set({ status: 'analyzing', error: null })
    try {
      const [result] = await Promise.all([
        window.fuzzy.glossary.build(documentId),
        delay(MIN_ANALYZE_MS)
      ])
      if (activeRun !== token) return
      set({ status: 'done', result })
    } catch (err) {
      if (activeRun !== token) return
      set({ status: 'error', error: err instanceof Error ? err.message : 'Glossary failed' })
    }
  },

  // A glossary term belongs to the active document by construction (built for it).
  showTerm: (term) => {
    const documentId = useDocumentStore.getState().activeDocumentId
    if (!documentId) return
    usePdfStore.getState().setPage(term.pageNumber)
    useAppUiStore.getState().requestPassageHighlight({
      documentId,
      pageNumber: term.pageNumber,
      snippet: term.sourceQuote
    })
  },

  reset: () => set({ status: 'idle', result: null, error: null })
}))
