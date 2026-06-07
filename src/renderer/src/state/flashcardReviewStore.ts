import { create } from 'zustand'
import type { DueCard, ReviewGrade } from '@shared/types/database'

// Cross-document spaced-repetition queue. Powers the "Review due" affordance and
// the Home review card. The in-pack flashcard study mode grades cards directly
// via the API; this store owns the global due list + count.

interface FlashcardReviewState {
  dueCards: DueCard[]
  dueCount: number
  loading: boolean

  loadDue: (limit?: number) => Promise<void>
  loadDueCount: () => Promise<void>
  // Grade a card and drop it from the local queue (it is no longer due now).
  grade: (card: DueCard, grade: ReviewGrade) => Promise<void>
}

export const useFlashcardReviewStore = create<FlashcardReviewState>((set, get) => ({
  dueCards: [],
  dueCount: 0,
  loading: false,

  loadDue: async (limit) => {
    set({ loading: true })
    try {
      const dueCards = await window.fuzzy.flashcardReviews.due(limit)
      set({ dueCards, dueCount: dueCards.length, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  loadDueCount: async () => {
    try {
      const dueCount = await window.fuzzy.flashcardReviews.dueCount()
      set({ dueCount })
    } catch {
      /* non-fatal */
    }
  },

  grade: async (card, grade) => {
    // Optimistic: remove from the queue immediately.
    set((s) => ({
      dueCards: s.dueCards.filter(
        (c) => !(c.studyPackId === card.studyPackId && c.cardIndex === card.cardIndex)
      ),
      dueCount: Math.max(0, s.dueCount - 1)
    }))
    try {
      await window.fuzzy.flashcardReviews.grade(
        card.studyPackId,
        card.documentId,
        card.cardIndex,
        grade
      )
    } catch {
      // Re-sync from the source of truth on failure.
      void get().loadDue()
    }
  }
}))
