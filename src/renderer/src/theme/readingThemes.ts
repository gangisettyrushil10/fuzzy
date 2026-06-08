import type { ReaderPrefs, ReadingThemeId } from '@shared/types/database'

// Reading-surface (page) color schemes, independent of the whole-app theme.
// These set the document page's background + text color only — the app chrome
// stays on the active app theme. `match-app` resolves to the app theme's
// surface/fg at the CSS-var LEVEL (returns var() references, not snapshots), so
// swapping the app theme recolors the reading surface for free, with no JS
// coordination between the appearance store and the reader-prefs store.
export interface ReadingSurface {
  pageBg: string
  pageFg: string
}

const FIXED_SURFACES: Record<Exclude<ReadingThemeId, 'match-app' | 'custom'>, ReadingSurface> = {
  // Warm off-white like e-ink paper.
  paper: { pageBg: '#f7f3ea', pageFg: '#23201a' },
  // Classic Kindle sepia.
  sepia: { pageBg: '#e9dcc3', pageFg: '#3a2f23' },
  // Dimmed dark, easy at night.
  night: { pageBg: '#1c1d21', pageFg: '#cdcdd2' },
  // True-black for OLED.
  black: { pageBg: '#000000', pageFg: '#c8c8cf' }
}

const MATCH_APP: ReadingSurface = {
  pageBg: 'var(--color-fz-surface)',
  pageFg: 'var(--color-fz-fg)'
}

// Resolve the page bg/fg for the active reader prefs. `custom` uses the saved
// hex (falling back to match-app for any missing side).
export function resolveReadingSurface(prefs: ReaderPrefs): ReadingSurface {
  const id = prefs.readingTheme
  if (id === 'match-app') return MATCH_APP
  if (id === 'custom') {
    return {
      pageBg: prefs.customPageBg ?? MATCH_APP.pageBg,
      pageFg: prefs.customPageFg ?? MATCH_APP.pageFg
    }
  }
  return FIXED_SURFACES[id] ?? MATCH_APP
}

// Swatch colors for the reading-theme picker (concrete, never var()-based, so
// the swatch renders the same regardless of the app theme).
export const READING_THEME_SWATCHES: Record<ReadingThemeId, ReadingSurface> = {
  'match-app': { pageBg: '#16161b', pageFg: '#e6e6ea' },
  ...FIXED_SURFACES,
  custom: { pageBg: '#888888', pageFg: '#ffffff' }
}

export const READING_THEME_LABELS: Record<ReadingThemeId, string> = {
  'match-app': 'App',
  paper: 'Paper',
  sepia: 'Sepia',
  night: 'Night',
  black: 'Black',
  custom: 'Custom'
}

// A PDF page is a baked canvas bitmap — its glyphs can't be re-fonted, so a
// reading theme can only recolor it with a CSS filter. invert+hue-rotate(180)
// gives a true-ish dark page that keeps color images from going radioactive;
// sepia/paper just warm the whites. 'match-app' and 'custom' leave the page
// untouched (the surrounding surface still follows the page-bg var).
export function pdfCanvasFilter(id: ReadingThemeId): string {
  switch (id) {
    case 'night':
      return 'invert(1) hue-rotate(180deg)'
    case 'black':
      return 'invert(1) hue-rotate(180deg) brightness(0.85) contrast(1.05)'
    case 'sepia':
      return 'sepia(0.45) contrast(0.95) brightness(0.95)'
    case 'paper':
      return 'sepia(0.16) brightness(0.99) contrast(0.98)'
    default:
      return 'none'
  }
}
