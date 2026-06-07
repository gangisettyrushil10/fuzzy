import { create } from 'zustand'
import { DEFAULT_STUDY_PACK_PREFS, type StudyPackPrefs } from '@shared/types/database'

// Study-pack preferences (last-used generation options + default export format +
// spaced-repetition toggle). Persisted as one JSON blob via the settings KV
// table. Optimistic on change so the options modal feels instant, mirroring
// readerPrefsStore.

interface StudyPackPrefsState {
  prefs: StudyPackPrefs
  loaded: boolean
  load: () => Promise<void>
  set: (patch: Partial<StudyPackPrefs>) => Promise<void>
}

export const useStudyPackPrefsStore = create<StudyPackPrefsState>((set, get) => ({
  prefs: DEFAULT_STUDY_PACK_PREFS,
  loaded: false,

  load: async () => {
    try {
      const prefs = await window.fuzzy.settings.getStudyPackPrefs()
      set({ prefs, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  set: async (patch) => {
    const optimistic = { ...get().prefs, ...patch }
    set({ prefs: optimistic })
    try {
      const saved = await window.fuzzy.settings.setStudyPackPrefs(patch)
      set({ prefs: saved })
    } catch {
      /* keep optimistic value */
    }
  }
}))
