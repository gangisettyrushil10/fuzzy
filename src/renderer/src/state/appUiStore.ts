import { create } from 'zustand'
import type { NormalizedRect } from './selectionStore'
import type { AnnotationRecord } from '@shared/types/database'

export interface PassageFlashTarget {
  pageNumber: number
  rectsOnPage: NormalizedRect[]
  annotationId?: string
}

// A request to project a thesis snippet onto a page. The reader resolves it to
// real rects (PDF: via word geometry) and flashes them. Distinct from the
// rect-based passageFlash, which is what actually renders.
export interface PassageHighlightRequest {
  documentId: string
  pageNumber: number
  snippet: string
}

interface AppUiState {
  commandPaletteOpen: boolean
  settingsOpen: boolean
  studyPackOpen: boolean
  planModalOpen: boolean
  statsOpen: boolean
  shortcutsOpen: boolean
  digestOpen: boolean
  essayOpen: boolean
  passageFlash: PassageFlashTarget | null
  passageHighlight: PassageHighlightRequest | null
  /** Annotation opened from gutter/sidebar for the tutor panel. */
  focusedAnnotation: AnnotationRecord | null

  setCommandPaletteOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setStudyPackOpen: (open: boolean) => void
  setPlanModalOpen: (open: boolean) => void
  setStatsOpen: (open: boolean) => void
  setShortcutsOpen: (open: boolean) => void
  setDigestOpen: (open: boolean) => void
  setEssayOpen: (open: boolean) => void
  flashPassage: (target: PassageFlashTarget) => void
  clearPassageFlash: () => void
  requestPassageHighlight: (req: PassageHighlightRequest) => void
  clearPassageHighlight: () => void
  setFocusedAnnotation: (ann: AnnotationRecord | null) => void

  /** Close palette, selection menu (via callback), modals. */
  dismissTransientUi: () => void
  registerDismissHandler: (fn: () => void) => () => void
}

let dismissHandlers: Array<() => void> = []

export const useAppUiStore = create<AppUiState>((set) => ({
  commandPaletteOpen: false,
  settingsOpen: false,
  studyPackOpen: false,
  planModalOpen: false,
  statsOpen: false,
  shortcutsOpen: false,
  digestOpen: false,
  essayOpen: false,
  passageFlash: null,
  passageHighlight: null,
  focusedAnnotation: null,

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setStudyPackOpen: (open) => set({ studyPackOpen: open }),
  setPlanModalOpen: (open) => set({ planModalOpen: open }),
  setStatsOpen: (open) => set({ statsOpen: open }),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  setDigestOpen: (open) => set({ digestOpen: open }),
  setEssayOpen: (open) => set({ essayOpen: open }),

  flashPassage: (target) => set({ passageFlash: target }),
  clearPassageFlash: () => set({ passageFlash: null }),
  requestPassageHighlight: (req) => set({ passageHighlight: req }),
  clearPassageHighlight: () => set({ passageHighlight: null }),
  setFocusedAnnotation: (ann) => set({ focusedAnnotation: ann }),

  dismissTransientUi: () => {
    set({
      commandPaletteOpen: false,
      planModalOpen: false,
      studyPackOpen: false
    })
    for (const fn of dismissHandlers) fn()
  },

  registerDismissHandler: (fn) => {
    dismissHandlers.push(fn)
    return () => {
      dismissHandlers = dismissHandlers.filter((h) => h !== fn)
    }
  }
}))
