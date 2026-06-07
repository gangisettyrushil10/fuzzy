import { create } from 'zustand'
import type { AskResult, RankedPassage } from '@shared/types/database'
import { useDocumentStore } from './documentStore'
import { usePdfStore } from './pdfStore'
import { useAppUiStore } from './appUiStore'

// "Ask the book": RAG chat scoped to the active document, every answer cited and
// jump-able. spoilerSafe restricts retrieval to pages <= the current page — a
// recall feature ChatGPT can't do because it doesn't know where you are.

type AskStatus = 'idle' | 'asking' | 'done' | 'error'

interface AskState {
  question: string
  spoilerSafe: boolean
  status: AskStatus
  result: AskResult | null
  error: string | null

  setQuestion: (q: string) => void
  setSpoilerSafe: (v: boolean) => void
  ask: () => Promise<void>
  showInPage: (source: RankedPassage) => void
  reset: () => void
}

let runCounter = 0
let activeRun = 0

export const useAskStore = create<AskState>((set, get) => ({
  question: '',
  spoilerSafe: false,
  status: 'idle',
  result: null,
  error: null,

  setQuestion: (question) => set({ question }),
  setSpoilerSafe: (spoilerSafe) => set({ spoilerSafe }),

  ask: async () => {
    const { question, spoilerSafe } = get()
    if (!question.trim()) return
    const documentId = useDocumentStore.getState().activeDocumentId
    if (!documentId) {
      set({ status: 'error', error: 'Open a document first to ask about it.' })
      return
    }
    const currentPage = usePdfStore.getState().currentPage
    const token = ++runCounter
    activeRun = token
    set({ status: 'asking', error: null })
    try {
      const result = await window.fuzzy.ask.query({ documentId, question, spoilerSafe, currentPage })
      if (activeRun !== token) return
      set({ status: 'done', result })
    } catch (err) {
      if (activeRun !== token) return
      set({ status: 'error', error: err instanceof Error ? err.message : 'Ask failed' })
    }
  },

  showInPage: (source) => {
    const docStore = useDocumentStore.getState()
    if (docStore.activeDocumentId !== source.documentId) docStore.setActiveDocument(source.documentId)
    usePdfStore.getState().setPage(source.pageNumber)
    useAppUiStore.getState().requestPassageHighlight({
      documentId: source.documentId,
      pageNumber: source.pageNumber,
      snippet: source.snippet
    })
  },

  reset: () => set({ status: 'idle', result: null, error: null })
}))
