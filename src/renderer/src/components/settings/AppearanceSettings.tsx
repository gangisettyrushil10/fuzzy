import { useAppearanceStore } from '../../state/appearanceStore'
import { THEME_LIST, THEMES, type Theme, type ThemePalette } from '../../theme/themes'
import { ACCENT_PRESETS, DEFAULT_CUSTOM_ACCENT } from '../../theme/accents'
import { resolveTheme } from '../../theme/applyTheme'
import { Section } from '../ui'
import { cn } from '../../lib/cn'

// The Appearance tab of Settings: a live theme gallery + accent picker. Every
// choice writes through useAppearanceStore.set, which applies the CSS variables
// immediately, so the whole app (including this modal) recolors as you click.
export function AppearanceSettings(): React.JSX.Element {
  const prefs = useAppearanceStore((s) => s.prefs)
  const set = useAppearanceStore((s) => s.set)

  const darkThemes = THEME_LIST.filter((t) => t.group === 'dark')
  const lightThemes = THEME_LIST.filter((t) => t.group === 'light')
  // The accent shown on the "Theme default" dot tracks the resolved theme.
  const activeTheme = resolveTheme(prefs.themeId)

  return (
    <div className="space-y-6">
      <Section title="Theme" description="Pick a palette for the whole app — changes apply instantly.">
        <div className="space-y-4">
          <AutoCard selected={prefs.themeId === 'auto'} onSelect={() => void set({ themeId: 'auto' })} />
          <ThemeGroup
            label="Dark"
            themes={darkThemes}
            selectedId={prefs.themeId}
            onSelect={(id) => void set({ themeId: id })}
          />
          <ThemeGroup
            label="Light"
            themes={lightThemes}
            selectedId={prefs.themeId}
            onSelect={(id) => void set({ themeId: id })}
          />
        </div>
      </Section>

      <Section
        title="Accent color"
        description="Drives highlights, the pacer sweep, focus rings, and primary buttons."
      >
        <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap items-center gap-2.5">
          <AccentDot
            label="Theme default"
            color={activeTheme.palette['accent-2']}
            selected={prefs.accentId === 'theme'}
            onClick={() => void set({ accentId: 'theme' })}
          />
          {ACCENT_PRESETS.map((a) => (
            <AccentDot
              key={a.id}
              label={a.name}
              color={a.accent2}
              selected={prefs.accentId === a.id}
              onClick={() => void set({ accentId: a.id })}
            />
          ))}
          <CustomAccentDot
            value={prefs.customAccent ?? DEFAULT_CUSTOM_ACCENT}
            selected={prefs.accentId === 'custom'}
            onChange={(hex) => void set({ accentId: 'custom', customAccent: hex })}
          />
        </div>
        <p className="mt-2 text-fz-micro text-fz-fg-subtle">
          {prefs.accentId === 'custom'
            ? `Custom — ${(prefs.customAccent ?? DEFAULT_CUSTOM_ACCENT).toUpperCase()}`
            : prefs.accentId === 'theme'
              ? 'Following the selected theme’s built-in accent.'
              : 'Tap the rightmost swatch to pick any custom color.'}
        </p>
      </Section>
    </div>
  )
}

function ThemeGroup({
  label,
  themes,
  selectedId,
  onSelect
}: {
  label: string
  themes: Theme[]
  selectedId: string
  onSelect: (id: Theme['id']) => void
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <span className="text-fz-micro font-semibold uppercase tracking-wider text-fz-fg-subtle">
        {label}
      </span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {themes.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            selected={selectedId === theme.id}
            onSelect={() => onSelect(theme.id)}
          />
        ))}
      </div>
    </div>
  )
}

function ThemeCard({
  theme,
  selected,
  onSelect
}: {
  theme: Theme
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      title={theme.description}
      className={cn(
        'group flex flex-col gap-2 rounded-lg border p-2 text-left transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fz-accent',
        selected
          ? 'border-fz-accent-2 bg-fz-accent-2/10'
          : 'border-fz-border hover:border-fz-fg-subtle/50 hover:bg-fz-elevated/40'
      )}
    >
      <ThemePreview palette={theme.palette} />
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-fz-ui font-medium text-fz-fg">{theme.name}</span>
        {selected && (
          <span aria-hidden className="shrink-0 text-fz-ui text-fz-accent">
            ✓
          </span>
        )}
      </div>
    </button>
  )
}

// A miniature of a theme rendered from its raw palette values (NOT the active
// CSS variables) so every card previews its own colors regardless of the
// currently-applied theme.
function ThemePreview({ palette }: { palette: ThemePalette }): React.JSX.Element {
  return (
    <div
      className="h-16 w-full overflow-hidden rounded-md ring-1 ring-black/10"
      style={{ background: palette.bg }}
    >
      <div className="flex h-full gap-1.5 p-1.5">
        <div
          className="flex flex-1 flex-col justify-center gap-1 rounded px-1.5"
          style={{ background: palette.surface }}
        >
          <span className="h-1.5 w-3/4 rounded-full" style={{ background: palette.fg }} />
          <span className="h-1.5 w-full rounded-full" style={{ background: palette['fg-muted'] }} />
          <span className="h-1.5 w-1/2 rounded-full" style={{ background: palette['fg-subtle'] }} />
        </div>
        <div className="flex flex-col justify-between py-0.5">
          <span className="h-4 w-4 rounded-full" style={{ background: palette['accent-2'] }} />
          <span className="h-4 w-4 rounded-full" style={{ background: palette.accent }} />
        </div>
      </div>
    </div>
  )
}

function AutoCard({
  selected,
  onSelect
}: {
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border p-2 text-left transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fz-accent',
        selected
          ? 'border-fz-accent-2 bg-fz-accent-2/10'
          : 'border-fz-border hover:border-fz-fg-subtle/50 hover:bg-fz-elevated/40'
      )}
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md ring-1 ring-black/10">
        <span className="absolute inset-0" style={{ background: THEMES.daylight.palette.bg }} />
        <span
          className="absolute inset-0"
          style={{ background: THEMES.midnight.palette.bg, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
        />
        <span
          className="absolute left-1.5 top-1.5 h-2.5 w-2.5 rounded-full"
          style={{ background: THEMES.midnight.palette['accent-2'] }}
        />
        <span
          className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-full"
          style={{ background: THEMES.daylight.palette['accent-2'] }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-fz-ui font-medium text-fz-fg">Auto</span>
          {selected && (
            <span aria-hidden className="text-fz-ui text-fz-accent">
              ✓
            </span>
          )}
        </div>
        <p className="mt-0.5 text-fz-micro text-fz-fg-subtle">
          Match the macOS system appearance (switches light / dark with it).
        </p>
      </div>
    </button>
  )
}

function AccentDot({
  label,
  color,
  selected,
  onClick
}: {
  label: string
  color: string
  selected: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'relative h-8 w-8 rounded-full transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fz-accent',
        selected
          ? 'ring-2 ring-fz-fg ring-offset-2 ring-offset-fz-surface'
          : 'ring-1 ring-black/20 hover:scale-110'
      )}
      style={{ background: color }}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center text-fz-micro font-bold text-white mix-blend-difference"
        >
          ✓
        </span>
      )}
    </button>
  )
}

// The custom swatch wraps a native color <input>: the input is invisible but
// fills the dot, so a click opens the OS color picker and the label background
// shows the chosen color live.
function CustomAccentDot({
  value,
  selected,
  onChange
}: {
  value: string
  selected: boolean
  onChange: (hex: string) => void
}): React.JSX.Element {
  return (
    <label
      title="Custom color"
      className={cn(
        'relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition',
        selected
          ? 'ring-2 ring-fz-fg ring-offset-2 ring-offset-fz-surface'
          : 'ring-1 ring-black/20 hover:scale-110'
      )}
      style={{ background: value }}
    >
      <span aria-hidden className="text-fz-micro font-bold text-white mix-blend-difference">
        {selected ? '✓' : '+'}
      </span>
      <input
        type="color"
        value={value}
        aria-label="Custom accent color"
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  )
}
