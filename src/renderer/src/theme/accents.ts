import type { AccentId } from '@shared/types/database'

// A preset accent overrides the active theme's own accent tokens. `accent` is
// the soft/light tone (→ --color-fz-accent, used for hairlines, focus rings,
// dotted underlines); `accent2` is the saturated tone (→ --color-fz-accent-2,
// used for primary buttons and active states). Keep ids in lockstep with
// ACCENT_IDS in shared/types/database.ts.
export interface AccentPreset {
  id: Exclude<AccentId, 'theme' | 'custom'>
  name: string
  accent: string
  accent2: string
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'purple', name: 'Purple', accent: '#b794f4', accent2: '#7c5cff' },
  { id: 'blue', name: 'Blue', accent: '#60a5fa', accent2: '#3b82f6' },
  { id: 'teal', name: 'Teal', accent: '#2dd4bf', accent2: '#14b8a6' },
  { id: 'green', name: 'Green', accent: '#4ade80', accent2: '#22c55e' },
  { id: 'amber', name: 'Amber', accent: '#fbbf24', accent2: '#f59e0b' },
  { id: 'rose', name: 'Rose', accent: '#fb7185', accent2: '#f43f5e' },
  { id: 'crimson', name: 'Crimson', accent: '#f87171', accent2: '#ef4444' },
  { id: 'mono', name: 'Graphite', accent: '#a1a1aa', accent2: '#71717a' }
]

export const ACCENT_PRESET_BY_ID = Object.fromEntries(
  ACCENT_PRESETS.map((a) => [a.id, a])
) as Record<AccentPreset['id'], AccentPreset>

// Fallback hex shown in the custom-color picker before the user has picked one.
export const DEFAULT_CUSTOM_ACCENT = '#7c5cff'
