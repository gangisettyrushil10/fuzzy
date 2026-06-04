import { create } from 'zustand'
import type { NormalizedRect } from './selectionStore'
import type { AnnotationRecord } from '@shared/types/database'

export interface PassageFlashTarget {
  pageNumber: number
  rectsOnPage: NormalizedRect[]
  annotationId?: string
}

interface AppUiState {
  commandPaletteOpen: boolean
  settingsOpen: boolean
  studyPackOpen: boolean
  planModalOpen: boolean
  passageFlash: PassageFlashTarget | null
  /** Annotation opened from gutter/sidebar for the tutor panel. */
  focusedAnnotation: AnnotationRecord | null

  setCommandPaletteOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setStudyPackOpen: (open: boolean) => void
  setPlanModalOpen: (open: boolean) => void
  flashPassage: (target: PassageFlashTarget) => void
  clearPassageFlash: () => void
  setFocusedAnnotation: (ann: AnnotationRecord | null) => void

  /** Close palette, selection menu (via callback), modals. */
  dismissTransientUi: () => void
  registerDismissHandler: (fn: () => void) => () => void
}

let dismissHandlers: Array<() => void> = []

export const useAppUiStore = create<AppUiState>((set, get) => ({
  commandPaletteOpen: false,
  settingsOpen: false,
  studyPackOpen: false,
  planModalOpen: false,
  passageFlash: null,
  focusedAnnotation: null,

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setStudyPackOpen: (open) => set({ studyPackOpen: open }),
  setPlanModalOpen: (open) => set({ planModalOpen: open }),

  flashPassage: (target) => set({ passageFlash: target }),
  clearPassageFlash: () => set({ passageFlash: null }),
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
