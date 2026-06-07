import { create } from 'zustand'
import {
  DEFAULT_READER_PREFS,
  type ReaderContentWidth,
  type ReaderPrefs
} from '@shared/types/database'
import { fontStackFor } from '../theme/readerFonts'
import { resolveReadingSurface } from '../theme/readingThemes'

// Reader typography + reading-aid preferences. Persisted as one JSON blob via
// the settings KV table (see settingsService). On load/change it writes the
// reader CSS custom properties so .prose-fz (and the reader root) update live.
// Pacer TRANSPORT state (status/activeIndex) lives in pacerStore — this store
// only holds persisted preferences.

const CONTENT_WIDTH_REM: Record<ReaderContentWidth, number> = {
  narrow: 36,
  normal: 48,
  wide: 64
}

function applyReaderCssVars(prefs: ReaderPrefs): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--fz-reader-font-size', `${prefs.fontSize}px`)
  root.style.setProperty('--fz-reader-line-height', String(prefs.lineHeight))
  root.style.setProperty('--fz-reader-width', `${CONTENT_WIDTH_REM[prefs.contentWidth]}rem`)
  root.style.setProperty('--fz-reader-font-family', fontStackFor(prefs.fontFamily))
  root.style.setProperty('--fz-reader-text-align', prefs.textAlign)
  root.style.setProperty('--fz-reader-para-spacing', `${prefs.paragraphSpacing}em`)
  root.style.setProperty('--fz-reader-letter-spacing', `${prefs.letterSpacing}em`)
  // Reading surface (page colors). 'match-app' resolves to var(--color-fz-*)
  // strings, so an app-theme swap recolors the page with no extra JS.
  const surface = resolveReadingSurface(prefs)
  root.style.setProperty('--fz-reader-page-bg', surface.pageBg)
  root.style.setProperty('--fz-reader-page-fg', surface.pageFg)
}

interface ReaderPrefsState {
  prefs: ReaderPrefs
  loaded: boolean
  load: () => Promise<void>
  set: (patch: Partial<ReaderPrefs>) => Promise<void>
}

export const useReaderPrefsStore = create<ReaderPrefsState>((set, get) => ({
  prefs: DEFAULT_READER_PREFS,
  loaded: false,

  load: async () => {
    try {
      const prefs = await window.fuzzy.settings.getReaderPrefs()
      applyReaderCssVars(prefs)
      set({ prefs, loaded: true })
    } catch {
      // Defaults already cover first paint; mark loaded so the UI is usable.
      applyReaderCssVars(get().prefs)
      set({ loaded: true })
    }
  },

  set: async (patch) => {
    // Optimistic: apply immediately so sliders feel instant, then persist and
    // adopt the server-normalized (clamped) result.
    const optimistic = { ...get().prefs, ...patch }
    applyReaderCssVars(optimistic)
    set({ prefs: optimistic })
    try {
      const saved = await window.fuzzy.settings.setReaderPrefs(patch)
      applyReaderCssVars(saved)
      set({ prefs: saved })
    } catch {
      /* keep optimistic value */
    }
  }
}))
