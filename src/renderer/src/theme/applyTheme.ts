import type { AppearancePrefs, ThemeId } from '@shared/types/database'
import { ACCENT_PRESET_BY_ID } from './accents'
import { DEFAULT_THEME_ID, THEMES, type ConcreteThemeId, type Theme } from './themes'

// Resolved accent pair, ready to write to CSS variables.
export interface ResolvedAccent {
  accent: string
  accent2: string
}

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

// Collapse the 'auto' sentinel to a concrete id using the OS color-scheme.
export function resolveThemeId(id: ThemeId): ConcreteThemeId {
  if (id === 'auto') return prefersDark() ? 'midnight' : 'daylight'
  return id
}

export function resolveTheme(id: ThemeId): Theme {
  return THEMES[resolveThemeId(id)] ?? THEMES[DEFAULT_THEME_ID]
}

// Decide the accent pair for the given prefs against a resolved theme. For a
// custom hex we derive the soft tone by mixing toward white (dark themes) or
// black (light themes) so the lighter accent reads correctly on the surface.
export function resolveAccent(prefs: AppearancePrefs, theme: Theme): ResolvedAccent {
  if (prefs.accentId === 'theme') {
    return { accent: theme.palette.accent, accent2: theme.palette['accent-2'] }
  }
  if (prefs.accentId === 'custom') {
    const c = prefs.customAccent ?? theme.palette['accent-2']
    const towards = theme.mode === 'dark' ? '#ffffff' : '#000000'
    return { accent: `color-mix(in srgb, ${c} 70%, ${towards})`, accent2: c }
  }
  const preset = ACCENT_PRESET_BY_ID[prefs.accentId]
  if (!preset) return { accent: theme.palette.accent, accent2: theme.palette['accent-2'] }
  return { accent: preset.accent, accent2: preset.accent2 }
}

// Write the resolved theme + accent onto :root as CSS custom properties.
// Tailwind utilities read these via var(), so every `bg-fz-*`/`text-fz-*` and
// the accent-derived color-mix vars in globals.css update in one paint.
export function applyAppearance(prefs: AppearancePrefs): void {
  if (typeof document === 'undefined') return
  const theme = resolveTheme(prefs.themeId)
  const root = document.documentElement

  for (const [token, value] of Object.entries(theme.palette)) {
    root.style.setProperty(`--color-fz-${token}`, value)
  }

  const { accent, accent2 } = resolveAccent(prefs, theme)
  root.style.setProperty('--color-fz-accent', accent)
  root.style.setProperty('--color-fz-accent-2', accent2)

  // Native chrome (scrollbars, the color <input>, autofill) follows this.
  root.style.colorScheme = theme.mode
  root.setAttribute('data-theme', theme.id)
  root.setAttribute('data-theme-mode', theme.mode)
}
