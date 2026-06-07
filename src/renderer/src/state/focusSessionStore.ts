import { create } from 'zustand'
import type { FocusGoalType, ReadingStats } from '@shared/types/database'
import { useReaderPrefsStore } from './readerPrefsStore'
import { usePdfStore } from './pdfStore'

// Focus Sessions: timed, distraction-free reading. The live timer is derived
// from startedAtMs; the HUD drives a per-second tick and a ~15s heartbeat that
// persists progress so a crash/reload doesn't lose the session. Words-read is
// accumulated from page/section turns (notePageAdvance) by the readers.

interface ActiveSession {
  id: string
  documentId: string
  startedAtMs: number
  wordsRead: number
  pageEnd: number | null
}

interface FocusSessionState {
  active: ActiveSession | null
  goalType: FocusGoalType
  goalTargetMinutes: number
  stats: ReadingStats | null

  setGoal: (type: FocusGoalType, targetMinutes: number) => void
  start: (documentId: string) => Promise<void>
  end: () => Promise<void>
  notePageAdvance: (words: number, page: number | null) => void
  heartbeat: () => Promise<void>
  elapsedSeconds: () => number
  loadStats: () => Promise<void>
  finalizeOpenFromCrash: () => Promise<void>
}

export const useFocusSessionStore = create<FocusSessionState>((set, get) => ({
  active: null,
  goalType: 'none',
  goalTargetMinutes: 20,
  stats: null,

  setGoal: (type, targetMinutes) => set({ goalType: type, goalTargetMinutes: targetMinutes }),

  start: async (documentId) => {
    if (get().active) return
    const { goalType, goalTargetMinutes } = get()
    const pageStart = usePdfStore.getState().currentPage || null
    const rec = await window.fuzzy.focus.start({
      documentId,
      pageStart,
      goalType,
      goalTarget: goalType === 'time' ? goalTargetMinutes : null
    })
    set({
      active: { id: rec.id, documentId, startedAtMs: Date.now(), wordsRead: 0, pageEnd: pageStart }
    })
    // Enter distraction-free mode.
    void useReaderPrefsStore.getState().set({ focusMode: true })
  },

  end: async () => {
    const a = get().active
    if (!a) return
    const elapsedSeconds = get().elapsedSeconds()
    set({ active: null })
    void useReaderPrefsStore.getState().set({ focusMode: false })
    await window.fuzzy.focus.end(a.id, {
      elapsedSeconds,
      wordsRead: a.wordsRead,
      pageEnd: a.pageEnd
    })
    await get().loadStats()
  },

  notePageAdvance: (words, page) => {
    const a = get().active
    if (!a) return
    set({
      active: {
        ...a,
        wordsRead: a.wordsRead + Math.max(0, Math.floor(words)),
        pageEnd: page ?? a.pageEnd
      }
    })
  },

  heartbeat: async () => {
    const a = get().active
    if (!a) return
    await window.fuzzy.focus.update(a.id, {
      elapsedSeconds: get().elapsedSeconds(),
      wordsRead: a.wordsRead,
      pageEnd: a.pageEnd
    })
  },

  elapsedSeconds: () => {
    const a = get().active
    return a ? Math.floor((Date.now() - a.startedAtMs) / 1000) : 0
  },

  loadStats: async () => {
    try {
      set({ stats: await window.fuzzy.focus.stats() })
    } catch {
      /* leave previous stats */
    }
  },

  finalizeOpenFromCrash: async () => {
    try {
      await window.fuzzy.focus.finalizeOpen()
    } catch {
      /* ignore */
    }
  }
}))
