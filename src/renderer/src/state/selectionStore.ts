import { create } from 'zustand'

// Normalised page-relative coordinates. Values are 0..1 fractions of the
// page's CSS width/height — that way the same rect lights up the right spot
// regardless of zoom or hi-DPI scaling at render time.
export interface NormalizedRect {
  x: number
  y: number
  width: number
  height: number
}

// A selection captured inside the PDF text layer. Anchored to a page so the
// AI request can carry the right context and the saved annotation can hop
// back to the right page later.
export interface PdfSelection {
  documentId: string
  pageNumber: number
  text: string
  // Floating-menu anchor. Coordinates are in viewport (window) space —
  // they only need to be valid for the current paint of the selection menu.
  anchorRect: { top: number; left: number; bottom: number; right: number }
  // Page-relative rects (normalised 0..1) for every line of the selection.
  // Empty if we could not compute them (e.g. selection outside a page).
  rectsOnPage: NormalizedRect[]
  // Optional nearby context for the AI request. PDF leaves this undefined and
  // the SelectionMenu falls back to the pdf store's per-page text; reflowable
  // readers (epub/txt/…) supply the current section's text directly here.
  contextText?: string | null
}

interface SelectionState {
  selection: PdfSelection | null
  setSelection: (s: PdfSelection | null) => void
  clear: () => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selection: null,
  setSelection: (s) => set({ selection: s }),
  clear: () => set({ selection: null })
}))
