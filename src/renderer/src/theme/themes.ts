import type { ThemeId } from '@shared/types/database'

// The full set of color tokens every theme must define. Each key maps to a
// `--color-fz-<key>` CSS custom property that Tailwind v4 utilities reference
// (e.g. `bg-fz-surface` → `background-color: var(--color-fz-surface)`).
// applyTheme writes these onto :root at runtime, overriding the static
// defaults declared in globals.css's @theme block.
export interface ThemePalette {
  bg: string
  surface: string
  'surface-2': string
  border: string
  fg: string
  'fg-muted': string
  'fg-subtle': string
  accent: string
  'accent-2': string
  danger: string
  warning: string
  success: string
  elevated: string
}

export type ThemeMode = 'dark' | 'light'

// Concrete (non-'auto') theme ids — 'auto' resolves to one of these.
export type ConcreteThemeId = Exclude<ThemeId, 'auto'>

export interface Theme {
  id: ConcreteThemeId
  name: string
  // Short blurb shown under the swatch in the picker.
  description: string
  group: ThemeMode
  // Drives `color-scheme` so native scrollbars / form controls / the color
  // picker chrome match, plus the lighten/darken direction for custom accents.
  mode: ThemeMode
  palette: ThemePalette
}

export const DEFAULT_THEME_ID: ConcreteThemeId = 'midnight'

// Ordered registry. The Midnight palette is byte-for-byte the @theme defaults
// in globals.css so first paint (before prefs load) matches the default theme.
export const THEMES: Record<ConcreteThemeId, Theme> = {
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    description: 'The Fuzzy default — near-black with a warm orange accent.',
    group: 'dark',
    mode: 'dark',
    palette: {
      bg: '#0b0b0d',
      surface: '#111114',
      'surface-2': '#16161b',
      border: '#232329',
      fg: '#e6e6ea',
      'fg-muted': '#8a8a93',
      'fg-subtle': '#5a5a63',
      accent: '#e8874a',
      'accent-2': '#c05a14',
      danger: '#f87171',
      warning: '#fbbf24',
      success: '#4ade80',
      elevated: '#1c1c22'
    }
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'True-black OLED with a cool indigo accent.',
    group: 'dark',
    mode: 'dark',
    palette: {
      bg: '#000000',
      surface: '#0a0a0c',
      'surface-2': '#121216',
      border: '#26262c',
      fg: '#ececf1',
      'fg-muted': '#8b8b94',
      'fg-subtle': '#56565e',
      accent: '#c4b5fd',
      'accent-2': '#8b5cf6',
      danger: '#f87171',
      warning: '#fbbf24',
      success: '#4ade80',
      elevated: '#161619'
    }
  },
  dim: {
    id: 'dim',
    name: 'Dim',
    description: 'Soft slate-blue grays — easy on the eyes at night.',
    group: 'dark',
    mode: 'dark',
    palette: {
      bg: '#1c2128',
      surface: '#22272e',
      'surface-2': '#2d333b',
      border: '#373e47',
      fg: '#cdd9e5',
      'fg-muted': '#909dab',
      'fg-subtle': '#636e7b',
      accent: '#79c0ff',
      'accent-2': '#388bfd',
      danger: '#f47067',
      warning: '#e3b341',
      success: '#57ab5a',
      elevated: '#2d333b'
    }
  },
  nord: {
    id: 'nord',
    name: 'Nord',
    description: 'Arctic, bluish palette with a frost accent.',
    group: 'dark',
    mode: 'dark',
    palette: {
      bg: '#2e3440',
      surface: '#3b4252',
      'surface-2': '#434c5e',
      border: '#4c566a',
      fg: '#eceff4',
      'fg-muted': '#d8dee9',
      'fg-subtle': '#7b88a1',
      accent: '#88c0d0',
      'accent-2': '#5e81ac',
      danger: '#bf616a',
      warning: '#ebcb8b',
      success: '#a3be8c',
      elevated: '#434c5e'
    }
  },
  dracula: {
    id: 'dracula',
    name: 'Dracula',
    description: 'Famous dark palette with a vivid purple accent.',
    group: 'dark',
    mode: 'dark',
    palette: {
      bg: '#282a36',
      surface: '#2f3140',
      'surface-2': '#383a4a',
      border: '#44475a',
      fg: '#f8f8f2',
      'fg-muted': '#b8bcd0',
      'fg-subtle': '#6272a4',
      accent: '#bd93f9',
      'accent-2': '#9d6cf0',
      danger: '#ff5555',
      warning: '#f1fa8c',
      success: '#50fa7b',
      elevated: '#383a4a'
    }
  },
  gruvbox: {
    id: 'gruvbox',
    name: 'Gruvbox',
    description: 'Warm, retro earth tones with a burnt-orange accent.',
    group: 'dark',
    mode: 'dark',
    palette: {
      bg: '#282828',
      surface: '#32302f',
      'surface-2': '#3c3836',
      border: '#504945',
      fg: '#ebdbb2',
      'fg-muted': '#bdae93',
      'fg-subtle': '#928374',
      accent: '#fe8019',
      'accent-2': '#d65d0e',
      danger: '#fb4934',
      warning: '#fabd2f',
      success: '#b8bb26',
      elevated: '#3c3836'
    }
  },
  'solarized-dark': {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    description: 'Precision-tuned teal-on-petrol classic.',
    group: 'dark',
    mode: 'dark',
    palette: {
      bg: '#002b36',
      surface: '#073642',
      'surface-2': '#0a4250',
      border: '#0e4b5a',
      fg: '#93a1a1',
      'fg-muted': '#839496',
      'fg-subtle': '#586e75',
      accent: '#2aa198',
      'accent-2': '#268bd2',
      danger: '#dc322f',
      warning: '#b58900',
      success: '#859900',
      elevated: '#0a4250'
    }
  },
  'high-contrast': {
    id: 'high-contrast',
    name: 'High Contrast',
    description: 'Maximum legibility — pure black, bright borders.',
    group: 'dark',
    mode: 'dark',
    palette: {
      bg: '#000000',
      surface: '#0a0a0a',
      'surface-2': '#161616',
      border: '#5a5a5a',
      fg: '#ffffff',
      'fg-muted': '#d4d4d4',
      'fg-subtle': '#a0a0a0',
      accent: '#5ac8fa',
      'accent-2': '#0a84ff',
      danger: '#ff453a',
      warning: '#ffd60a',
      success: '#30d158',
      elevated: '#1a1a1a'
    }
  },
  daylight: {
    id: 'daylight',
    name: 'Daylight',
    description: 'Clean, bright light theme for well-lit rooms.',
    group: 'light',
    mode: 'light',
    palette: {
      bg: '#f4f4f6',
      surface: '#ffffff',
      'surface-2': '#f0f0f3',
      border: '#e3e3e9',
      fg: '#1b1b1f',
      'fg-muted': '#5c5c66',
      'fg-subtle': '#8a8a94',
      accent: '#8b5cf6',
      'accent-2': '#7c3aed',
      danger: '#dc2626',
      warning: '#d97706',
      success: '#16a34a',
      elevated: '#f7f7fb'
    }
  },
  paper: {
    id: 'paper',
    name: 'Paper',
    description: 'Warm sepia tones that read like a printed page.',
    group: 'light',
    mode: 'light',
    palette: {
      bg: '#f1e7d0',
      surface: '#faf3e0',
      'surface-2': '#efe6cf',
      border: '#e2d6bb',
      fg: '#3b332a',
      'fg-muted': '#6f6253',
      'fg-subtle': '#9c8c74',
      accent: '#b5651d',
      'accent-2': '#985a16',
      danger: '#b3261e',
      warning: '#b7791f',
      success: '#5a7d3c',
      elevated: '#fdf6e3'
    }
  },
  'solarized-light': {
    id: 'solarized-light',
    name: 'Solarized Light',
    description: 'The sunlit half of the Solarized classic.',
    group: 'light',
    mode: 'light',
    palette: {
      bg: '#fdf6e3',
      surface: '#eee8d5',
      'surface-2': '#e7e0cb',
      border: '#d9d2bd',
      fg: '#586e75',
      'fg-muted': '#657b83',
      'fg-subtle': '#93a1a1',
      accent: '#2aa198',
      'accent-2': '#268bd2',
      danger: '#dc322f',
      warning: '#b58900',
      success: '#859900',
      elevated: '#fdf6e3'
    }
  }
}

// Display order for the theme gallery, grouped dark → light.
export const THEME_LIST: Theme[] = [
  THEMES.midnight,
  THEMES.obsidian,
  THEMES.dim,
  THEMES.nord,
  THEMES.dracula,
  THEMES.gruvbox,
  THEMES['solarized-dark'],
  THEMES['high-contrast'],
  THEMES.daylight,
  THEMES.paper,
  THEMES['solarized-light']
]
