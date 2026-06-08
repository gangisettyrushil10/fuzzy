import { useReaderPrefsStore } from '../../state/readerPrefsStore'
import {
  READER_FONT_IDS,
  READER_FONT_LABELS,
  READER_PREF_LIMITS,
  READING_THEME_IDS,
  type ReaderContentWidth,
  type ReaderTextAlign
} from '@shared/types/database'
import { READER_FONT_STACKS } from '../../theme/readerFonts'
import { READING_THEME_LABELS, READING_THEME_SWATCHES } from '../../theme/readingThemes'
import { SegmentedControl, Slider } from '../ui'
import { cn } from '../../lib/cn'

// The shared body of typography + reading-surface controls. Bound directly to
// readerPrefsStore (optimistic apply is built into `set`), so it's identical
// whether mounted in the in-reader "Aa" popover or the Settings → Reading tab.
export function ReaderTypographyControls(): React.JSX.Element {
  const prefs = useReaderPrefsStore((s) => s.prefs)
  const setPrefs = useReaderPrefsStore((s) => s.set)

  return (
    <div className="space-y-4">
      {/* Font family — chips rendered in their own face. */}
      <Field label="Font">
        <div className="grid grid-cols-2 gap-1.5">
          {READER_FONT_IDS.map((id) => {
            const active = prefs.fontFamily === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => void setPrefs({ fontFamily: id })}
                style={{ fontFamily: READER_FONT_STACKS[id] }}
                className={cn(
                  'truncate rounded-md border px-2.5 py-1.5 text-left text-fz-ui transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fz-accent',
                  active
                    ? 'border-fz-accent-2/60 bg-fz-accent-2/20 text-fz-fg'
                    : 'border-fz-border text-fz-fg-muted hover:bg-fz-elevated hover:text-fz-fg'
                )}
              >
                {READER_FONT_LABELS[id]}
              </button>
            )
          })}
        </div>
      </Field>

      {/* Reading theme (page colors) — swatch row + custom pickers. */}
      <Field label="Page theme">
        <div className="flex flex-wrap gap-1.5">
          {READING_THEME_IDS.map((id) => {
            const active = prefs.readingTheme === id
            const sw = READING_THEME_SWATCHES[id]
            return (
              <button
                key={id}
                type="button"
                aria-label={READING_THEME_LABELS[id]}
                title={READING_THEME_LABELS[id]}
                onClick={() => void setPrefs({ readingTheme: id })}
                style={{ background: sw.pageBg, color: sw.pageFg }}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border text-[13px] font-semibold transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fz-accent',
                  active
                    ? 'border-fz-accent ring-2 ring-fz-accent'
                    : 'border-fz-border hover:border-fz-fg-subtle'
                )}
              >
                Aa
              </button>
            )
          })}
        </div>
        {prefs.readingTheme === 'custom' && (
          <div className="mt-2 flex items-center gap-4">
            <ColorField
              label="Background"
              value={prefs.customPageBg ?? '#1c1d21'}
              onChange={(v) => void setPrefs({ customPageBg: v, readingTheme: 'custom' })}
            />
            <ColorField
              label="Text"
              value={prefs.customPageFg ?? '#e6e6ea'}
              onChange={(v) => void setPrefs({ customPageFg: v, readingTheme: 'custom' })}
            />
          </div>
        )}
      </Field>

      <Field label={`Font size — ${prefs.fontSize}px`}>
        <Slider
          aria-label="Font size"
          value={prefs.fontSize}
          min={READER_PREF_LIMITS.fontSize.min}
          max={READER_PREF_LIMITS.fontSize.max}
          step={1}
          onChange={(v) => void setPrefs({ fontSize: v })}
        />
      </Field>

      <Field label={`Line height — ${prefs.lineHeight.toFixed(2)}`}>
        <Slider
          aria-label="Line height"
          value={prefs.lineHeight}
          min={READER_PREF_LIMITS.lineHeight.min}
          max={READER_PREF_LIMITS.lineHeight.max}
          step={0.05}
          onChange={(v) => void setPrefs({ lineHeight: Number(v.toFixed(2)) })}
        />
      </Field>

      <Field label={`Paragraph spacing — ${prefs.paragraphSpacing.toFixed(1)}`}>
        <Slider
          aria-label="Paragraph spacing"
          value={prefs.paragraphSpacing}
          min={READER_PREF_LIMITS.paragraphSpacing.min}
          max={READER_PREF_LIMITS.paragraphSpacing.max}
          step={0.1}
          onChange={(v) => void setPrefs({ paragraphSpacing: Number(v.toFixed(1)) })}
        />
      </Field>

      <Field label={`Letter spacing — ${prefs.letterSpacing.toFixed(2)}em`}>
        <Slider
          aria-label="Letter spacing"
          value={prefs.letterSpacing}
          min={READER_PREF_LIMITS.letterSpacing.min}
          max={READER_PREF_LIMITS.letterSpacing.max}
          step={0.01}
          onChange={(v) => void setPrefs({ letterSpacing: Number(v.toFixed(2)) })}
        />
      </Field>

      <Field label="Column width">
        <SegmentedControl<ReaderContentWidth>
          size="sm"
          aria-label="Column width"
          value={prefs.contentWidth}
          onChange={(v) => void setPrefs({ contentWidth: v })}
          options={[
            { value: 'narrow', label: 'Narrow' },
            { value: 'normal', label: 'Normal' },
            { value: 'wide', label: 'Wide' }
          ]}
        />
      </Field>

      <Field label="Alignment">
        <SegmentedControl<ReaderTextAlign>
          size="sm"
          aria-label="Text alignment"
          value={prefs.textAlign}
          onChange={(v) => void setPrefs({ textAlign: v })}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'justify', label: 'Justified' }
          ]}
        />
      </Field>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <span className="block text-fz-ui text-fz-fg-muted">{label}</span>
      {children}
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <label className="flex items-center gap-2 text-fz-micro text-fz-fg-subtle">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-8 cursor-pointer rounded border border-fz-border bg-transparent"
      />
      {label}
    </label>
  )
}
