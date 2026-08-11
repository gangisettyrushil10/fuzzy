import { create } from 'zustand'

interface ReaderLocationInput {
  documentId: string
  currentPage: number
  currentPageText?: string | null
  highWaterMark?: number | null
}

interface ReaderLocationState {
  documentId: string | null
  currentPage: number | null
  currentPageText: string | null
  highWaterMark: number | null
  setLocation: (input: ReaderLocationInput) => void
  reset: (documentId?: string | null) => void
}

export const useReaderLocationStore = create<ReaderLocationState>((set, get) => ({
  documentId: null,
  currentPage: null,
  currentPageText: null,
  highWaterMark: null,

  setLocation: (input) => {
    const current = get()
    const previousHighWater =
      current.documentId === input.documentId ? (current.highWaterMark ?? input.currentPage) : input.currentPage
    const highWaterMark = Math.max(
      input.currentPage,
      input.highWaterMark ?? previousHighWater ?? input.currentPage
    )
    set({
      documentId: input.documentId,
      currentPage: input.currentPage,
      currentPageText: input.currentPageText ?? null,
      highWaterMark
    })
  },

  reset: (documentId) => {
    const current = get()
    if (documentId && current.documentId !== documentId) return
    set({ documentId: null, currentPage: null, currentPageText: null, highWaterMark: null })
  }
}))
