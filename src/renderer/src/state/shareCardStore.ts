import { create } from 'zustand'

export interface ShareExcerptInput {
  excerptText: string
  sourceTitle: string
  sourceAuthor?: string | null
  pageNumber?: number | null
}

interface ShareCardState {
  open: boolean
  excerpt: ShareExcerptInput | null
  openShare: (input: ShareExcerptInput) => void
  close: () => void
}

// UI-only, mirrors selectionStore.ts's shape. Sharing is stateless — nothing
// here persists past the modal's lifetime.
export const useShareCardStore = create<ShareCardState>((set) => ({
  open: false,
  excerpt: null,
  openShare: (input) => set({ open: true, excerpt: input }),
  close: () => set({ open: false, excerpt: null })
}))
