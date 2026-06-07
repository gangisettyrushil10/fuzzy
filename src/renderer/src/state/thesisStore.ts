import { create } from 'zustand'
import type {
  CitationFormat,
  RankedPassage,
  ThesisScope,
  ThesisSearchResult
} from '@shared/types/database'
import { useDocumentStore } from './documentStore'
import { usePdfStore } from './pdfStore'
import { useAppUiStore } from './appUiStore'
import { useReaderPrefsStore } from './readerPrefsStore'

// Thesis Workspace: real BM25 search over the library, with a short staged
// "analyzing" delay so the (real, fast) search still feels considered. Citation
// formatting is precomputed in main; we just pick which format to show.

type ThesisStatus = 'idle' | 'analyzing' | 'done' | 'error'

interface ThesisState {
  thesis: string
  scope: ThesisScope
  status: ThesisStatus
  result: ThesisSearchResult | null
  error: string | null

  setThesis: (thesis: string) => void
  setScope: (scope: ThesisScope) => void
  runSearch: () => Promise<void>
  showInPage: (passage: RankedPassage) => void
  reset: () => void
}

// Minimum time the "analyzing" stage shows, so a sub-50ms search doesn't blink.
const MIN_ANALYZE_MS = 500
let runCounter = 0
let activeRun = 0

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export const useThesisStore = create<ThesisState>((set, get) => ({
  thesis: '',
  scope: 'library',
  status: 'idle',
  result: null,
  error: null,

  setThesis: (thesis) => set({ thesis }),
  setScope: (scope) => set({ scope }),

  runSearch: async () => {
    const { thesis, scope } = get()
    if (!thesis.trim()) return
    const token = ++runCounter
    activeRun = token
    set({ status: 'analyzing', error: null })

    const activeDocumentId = useDocumentStore.getState().activeDocumentId
    try {
      const [result] = await Promise.all([
        window.fuzzy.thesis.search({ thesis, scope, activeDocumentId, limit: 12 }),
        delay(MIN_ANALYZE_MS)
      ])
      if (activeRun !== token) return
      set({ status: 'done', result })
    } catch (err) {
      if (activeRun !== token) return
      set({ status: 'error', error: err instanceof Error ? err.message : 'Thesis search failed' })
    }
  },

  // Navigate to the passage's source and project it onto the page. PDF resolves
  // the snippet to exact rects via word geometry; reflowable navigation is a
  // fast-follow, so for now we just open the document.
  showInPage: (passage) => {
    const docStore = useDocumentStore.getState()
    if (docStore.activeDocumentId !== passage.documentId) {
      docStore.setActiveDocument(passage.documentId)
    }
    usePdfStore.getState().setPage(passage.pageNumber)
    useAppUiStore.getState().requestPassageHighlight({
      documentId: passage.documentId,
      pageNumber: passage.pageNumber,
      snippet: passage.snippet
    })
  },

  reset: () => set({ status: 'idle', result: null, error: null })
}))

// Citation format is a reader preference (persisted). Thin helpers so the panel
// doesn't reach into two stores.
export function useCitationFormat(): CitationFormat {
  return useReaderPrefsStore((s) => s.prefs.citationFormat)
}
export function setCitationFormat(format: CitationFormat): void {
  void useReaderPrefsStore.getState().set({ citationFormat: format })
}
