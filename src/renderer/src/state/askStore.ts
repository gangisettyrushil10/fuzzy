import { create } from 'zustand'
import type { AskResult, RankedPassage } from '@shared/types/database'
import { useDocumentStore } from './documentStore'
import { usePdfStore } from './pdfStore'
import { useAppUiStore } from './appUiStore'

// "Ask the book": RAG chat scoped to the active document, every answer cited and
// jump-able. spoilerSafe restricts retrieval to pages <= highWaterMark (the
// furthest page ever reached), so jumping back to re-read an earlier chapter
// doesn't accidentally shrink the spoiler boundary.

type AskStatus = 'idle' | 'asking' | 'done' | 'error'

interface AskState {
  question: string
  spoilerSafe: boolean
  webSearch: boolean
  status: AskStatus
  result: AskResult | null
  error: string | null

  setQuestion: (q: string) => void
  setSpoilerSafe: (v: boolean) => void
  setWebSearch: (v: boolean) => void
  ask: () => Promise<void>
  showInPage: (source: RankedPassage) => void
  reset: () => void
}

let runCounter = 0
let activeRun = 0

export const useAskStore = create<AskState>((set, get) => ({
  question: '',
  spoilerSafe: false,
  webSearch: false,
  status: 'idle',
  result: null,
  error: null,

  setQuestion: (question) => set({ question }),
  // Spoiler-safe and web search are mutually exclusive: the web can't honor your
  // reading position, so enabling one disables the other.
  setSpoilerSafe: (spoilerSafe) => set(spoilerSafe ? { spoilerSafe, webSearch: false } : { spoilerSafe }),
  setWebSearch: (webSearch) => set(webSearch ? { webSearch, spoilerSafe: false } : { webSearch }),

  ask: async () => {
    const { question, spoilerSafe, webSearch } = get()
    if (!question.trim()) return
    const documentId = useDocumentStore.getState().activeDocumentId
    if (!documentId) {
      set({ status: 'error', error: 'Open a document first to ask about it.' })
      return
    }
    const { currentPage, highWaterMark } = usePdfStore.getState()
    const token = ++runCounter
    activeRun = token
    set({ status: 'asking', error: null })
    try {
      const result = await window.fuzzy.ask.query({
        documentId,
        question,
        spoilerSafe,
        webSearch,
        currentPage: spoilerSafe ? highWaterMark : currentPage
      })
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
