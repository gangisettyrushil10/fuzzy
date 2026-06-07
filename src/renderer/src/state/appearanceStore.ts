import { create } from 'zustand'
import { DEFAULT_APPEARANCE_PREFS, type AppearancePrefs } from '@shared/types/database'
import { applyAppearance } from '../theme/applyTheme'

// Whole-app theme + accent preferences. Persisted as one JSON blob via the
// settings KV table (see settingsService). Mirrors readerPrefsStore: optimistic
// apply so the picker feels instant, then adopt the server-normalized result.
// applyAppearance writes the CSS variables every theme/accent depends on.

interface AppearanceState {
  prefs: AppearancePrefs
  loaded: boolean
  load: () => Promise<void>
  set: (patch: Partial<AppearancePrefs>) => Promise<void>
}

// Re-apply when the OS flips light/dark, but only while the user is on 'auto'.
// Bound once, lazily, on first load() so SSR/test imports stay side-effect-free.
let systemThemeBound = false
function bindSystemThemeListener(getPrefs: () => AppearancePrefs): void {
  if (systemThemeBound || typeof window === 'undefined' || !window.matchMedia) return
  systemThemeBound = true
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = (): void => {
    if (getPrefs().themeId === 'auto') applyAppearance(getPrefs())
  }
  // addEventListener is the modern API; older WebKit only has addListener.
  if (mq.addEventListener) mq.addEventListener('change', onChange)
  else mq.addListener(onChange)
}

export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  prefs: DEFAULT_APPEARANCE_PREFS,
  loaded: false,

  load: async () => {
    bindSystemThemeListener(() => get().prefs)
    try {
      const prefs = await window.fuzzy.settings.getAppearancePrefs()
      applyAppearance(prefs)
      set({ prefs, loaded: true })
    } catch {
      // Defaults already match globals.css's @theme, so first paint is correct.
      applyAppearance(get().prefs)
      set({ loaded: true })
    }
  },

  set: async (patch) => {
    const optimistic = { ...get().prefs, ...patch }
    applyAppearance(optimistic)
    set({ prefs: optimistic })
    try {
      const saved = await window.fuzzy.settings.setAppearancePrefs(patch)
      applyAppearance(saved)
      set({ prefs: saved })
    } catch {
      /* keep optimistic value */
    }
  }
}))
