import { create } from 'zustand'
import type { ArgumentMapResult, SynthesisEvidence } from '@shared/types/database'
import { useDocumentStore } from './documentStore'
import { usePdfStore } from './pdfStore'
import { useAppUiStore } from './appUiStore'

// Argument Map ("reverse synthesis"): extract the active document's own thesis,
// claims, support, and rhetorical moves. Doc-scoped; no query needed.

type ArgumentStatus = 'idle' | 'analyzing' | 'done' | 'error'

interface ArgumentState {
  documentId: string | null
  status: ArgumentStatus
  result: ArgumentMapResult | null
  error: string | null

  run: () => Promise<void>
  showEvidence: (evidence: SynthesisEvidence) => void
  reset: () => void
}

const MIN_ANALYZE_MS = 500
let runCounter = 0
let activeRun = 0
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export const useArgumentStore = create<ArgumentState>((set) => ({
  documentId: null,
  status: 'idle',
  result: null,
  error: null,

  run: async () => {
    const documentId = useDocumentStore.getState().activeDocumentId
    if (!documentId) {
      set({ status: 'error', error: 'Open a document first to map its argument.' })
      return
    }
    const token = ++runCounter
    activeRun = token
    set({ status: 'analyzing', error: null, documentId })
    try {
      const [result] = await Promise.all([
        window.fuzzy.argument.map(documentId),
        delay(MIN_ANALYZE_MS)
      ])
      if (activeRun !== token) return
      set({ status: 'done', result })
    } catch (err) {
      if (activeRun !== token) return
      set({ status: 'error', error: err instanceof Error ? err.message : 'Argument map failed' })
    }
  },

  showEvidence: (evidence) => {
    const docStore = useDocumentStore.getState()
    if (docStore.activeDocumentId !== evidence.documentId) {
      docStore.setActiveDocument(evidence.documentId)
    }
    usePdfStore.getState().setPage(evidence.pageNumber)
    useAppUiStore.getState().requestPassageHighlight({
      documentId: evidence.documentId,
      pageNumber: evidence.pageNumber,
      snippet: evidence.quote
    })
  },

  reset: () => set({ status: 'idle', result: null, error: null })
}))
