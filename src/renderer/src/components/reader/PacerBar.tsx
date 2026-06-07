import { usePacerStore } from '../../state/pacerStore'
import { useReaderPrefsStore } from '../../state/readerPrefsStore'
import { READER_PREF_LIMITS } from '@shared/types/database'
import { IconButton, Slider, Tooltip } from '../ui'
import { cn } from '../../lib/cn'
import { PacerExplainCard } from './PacerExplainCard'

// Floating pacer transport, centered above the bottom bar. Visible only when
// the pacer is engaged (AppShell gates on pacerStore.visible).
export function PacerBar(): React.JSX.Element {
  const status = usePacerStore((s) => s.status)
  const words = usePacerStore((s) => s.words)
  const position = usePacerStore((s) => s.position)
  const wpm = usePacerStore((s) => s.wpm)
  const toggle = usePacerStore((s) => s.toggle)
  const stop = usePacerStore((s) => s.stop)
  const hide = usePacerStore((s) => s.hide)
  const setWpm = usePacerStore((s) => s.setWpm)
  const seek = usePacerStore((s) => s.seek)

  const focusMode = useReaderPrefsStore((s) => s.prefs.focusMode)
  const setPrefs = useReaderPrefsStore((s) => s.set)
  const explainEnabled = usePacerStore((s) => s.explainEnabled)
  const setExplainEnabled = usePacerStore((s) => s.setExplainEnabled)

  const total = words.length
  const current = position < 0 ? 0 : position + 1
  const playing = status === 'playing'
  const pct = total > 0 ? (current / total) * 100 : 0

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-9 z-40 flex flex-col items-center">
      <PacerExplainCard />
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-fz-border bg-fz-elevated/95 px-3 py-1.5 shadow-fz-pop backdrop-blur">
        <Tooltip label={playing ? 'Pause (Space)' : 'Play (Space)'}>
          <IconButton
            aria-label={playing ? 'Pause pacer' : 'Play pacer'}
            variant="ghost"
            size="sm"
            onClick={toggle}
            className="text-fz-accent"
          >
            {playing ? '⏸' : '▶'}
          </IconButton>
        </Tooltip>

        <div className="flex items-center gap-2">
          <span className="w-14 text-right text-fz-micro tabular-nums text-fz-fg-muted">
            {wpm} wpm
          </span>
          <Slider
            aria-label="Words per minute"
            value={wpm}
            min={READER_PREF_LIMITS.targetWpm.min}
            max={READER_PREF_LIMITS.targetWpm.max}
            step={10}
            onChange={setWpm}
            className="w-28"
          />
        </div>

        <div className="h-4 w-px bg-fz-border" />

        {/* Progress scrubber */}
        <div className="flex items-center gap-2">
          <span className="w-16 text-right text-fz-micro tabular-nums text-fz-fg-subtle">
            {current}/{total}
          </span>
          <input
            type="range"
            aria-label="Reading position"
            min={0}
            max={Math.max(total - 1, 0)}
            value={position < 0 ? 0 : position}
            onChange={(e) => seek(Number(e.target.value))}
            className="h-1.5 w-24 cursor-pointer appearance-none rounded-full accent-fz-accent-2"
            style={{
              background: `linear-gradient(to right, var(--color-fz-accent-2) ${pct}%, var(--color-fz-border) ${pct}%)`
            }}
          />
        </div>

        <div className="h-4 w-px bg-fz-border" />

        <Tooltip label="Focus mode (⇧F)">
          <IconButton
            aria-label="Toggle focus mode"
            variant="ghost"
            size="sm"
            onClick={() => setPrefs({ focusMode: !focusMode })}
            className={cn(focusMode && 'bg-fz-accent-2/25 text-fz-accent')}
          >
            ◎
          </IconButton>
        </Tooltip>

        <Tooltip label="Pause on complex words to explain">
          <IconButton
            aria-label="Toggle pause-to-explain"
            variant="ghost"
            size="sm"
            onClick={() => setExplainEnabled(!explainEnabled)}
            className={cn(explainEnabled && 'bg-fz-accent-2/25 text-fz-accent')}
          >
            ?
          </IconButton>
        </Tooltip>

        <Tooltip label="Stop pacer">
          <IconButton
            aria-label="Close pacer"
            variant="ghost"
            size="sm"
            onClick={() => {
              stop()
              hide()
            }}
          >
            ✕
          </IconButton>
        </Tooltip>
      </div>
    </div>
  )
}
