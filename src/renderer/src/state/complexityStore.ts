import { create } from 'zustand'

// Holds the single active word-definition popover. The complex-word DETECTION
// is pure (lib/complexity) and computed in the readers via useMemo; this store
// only tracks which word (if any) the reader clicked to define. Sensitivity
// lives in readerPrefs.

export interface DefinitionTarget {
  word: string
  documentId: string
  pageNumber: number
  contextText: string | null
  // Viewport-space anchor rect of the clicked word.
  anchor: { top: number; left: number; bottom: number; right: number }
}

interface ComplexityState {
  popover: DefinitionTarget | null
  openPopover: (target: DefinitionTarget) => void
  closePopover: () => void
}

export const useComplexityStore = create<ComplexityState>((set) => ({
  popover: null,
  openPopover: (target) => set({ popover: target }),
  closePopover: () => set({ popover: null })
}))
