import { useEffect, useMemo, useState } from 'react'
import { useReadingSessionStore } from '../../state/readingSessionStore'
import { usePacerStore } from '../../state/pacerStore'
import { READER_PREF_LIMITS } from '@shared/types/database'
import { toast } from '../../state/toastStore'

const PRESETS = [10, 20, 30, 45, 60, 90]

function clampWpm(n: number): number {
  return Math.min(READER_PREF_LIMITS.targetWpm.max, Math.max(READER_PREF_LIMITS.targetWpm.min, n))
}

export function ReadingPlanModal({
  documentId,
  onClose
}: {
  documentId: string
  onClose: () => void
}): React.JSX.Element {
  const generating = useReadingSessionStore((s) => s.generating)
  const error = useReadingSessionStore((s) => s.error)
  const createForActive = useReadingSessionStore((s) => s.createForActive)
  const setWpm = usePacerStore((s) => s.setWpm)
  const showPacer = usePacerStore((s) => s.show)

  const [minutes, setMinutes] = useState<number>(30)
  const [customInput, setCustomInput] = useState<string>('')
  const [totalWords, setTotalWords] = useState<number | null>(null)

  // Total words across the document drive the "finish in N minutes" pace.
  useEffect(() => {
    let cancelled = false
    window.fuzzy.pages
      .listForDocument(documentId)
      .then((pages) => {
        if (cancelled) return
        setTotalWords(pages.reduce((sum, p) => sum + (p.estimatedWordCount ?? 0), 0))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [documentId])

  const minutesToUse = customInput.trim() ? Number(customInput) : minutes
  const validMinutes = Number.isFinite(minutesToUse) && minutesToUse >= 1

  // The pace needed to finish the whole document in the chosen time.
  const requiredWpm = useMemo(() => {
    if (!totalWords || !validMinutes) return null
    return clampWpm(Math.round(totalWords / minutesToUse))
  }, [totalWords, minutesToUse, validMinutes])

  const handleGenerate = async (): Promise<void> => {
    if (!validMinutes) return
    const session = await createForActive(documentId, Math.round(minutesToUse))
    // Tie the time budget to the pacer: set the speed needed to finish in time
    // and surface the pacer so the reader can press play.
    if (requiredWpm) {
      setWpm(requiredWpm)
      showPacer()
      toast.success(`Pacing at ${requiredWpm} wpm to finish in ${Math.round(minutesToUse)} min`)
    }
    if (session) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-[440px] max-w-[90vw] rounded-lg border border-fz-border bg-fz-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-sm font-semibold text-fz-fg">How much time do you have?</h2>
        <p className="mb-4 text-[11px] text-fz-fg-muted">
          Fuzzy sets your reading pace to finish in time, and splits the document into deep-read, skim,
          and review-later sections.
        </p>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setMinutes(p)
                setCustomInput('')
              }}
              className={[
                'rounded-md border px-3 py-2 text-xs',
                minutes === p && !customInput.trim()
                  ? 'border-fz-accent-2/60 bg-fz-accent-2/10 text-fz-fg'
                  : 'border-fz-border bg-fz-bg text-fz-fg-muted hover:text-fz-fg'
              ].join(' ')}
            >
              {p} min
            </button>
          ))}
        </div>
        <div className="mb-3 flex items-center gap-2">
          <input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Custom minutes"
            inputMode="numeric"
            className="flex-1 rounded border border-fz-border bg-fz-bg px-2 py-1 text-xs text-fz-fg placeholder:text-fz-fg-subtle focus:border-fz-accent focus:outline-none"
          />
          <span className="text-[10px] text-fz-fg-subtle">min</span>
        </div>

        {requiredWpm && totalWords ? (
          <div className="mb-4 rounded-md border border-fz-border bg-fz-bg/50 p-2.5 text-[11px] text-fz-fg-muted">
            {totalWords.toLocaleString()} words → pace of{' '}
            <span className="font-semibold text-fz-accent">{requiredWpm} wpm</span> to finish in{' '}
            {Math.round(minutesToUse)} min.
            {requiredWpm >= READER_PREF_LIMITS.targetWpm.max && ' (That’s ambitious — consider more time.)'}
          </div>
        ) : null}

        {error && <div className="mb-3 text-[11px] text-red-300/80">{error}</div>}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-fz-border px-3 py-1 text-[11px] text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !validMinutes}
            className="rounded border border-fz-accent-2/60 bg-fz-accent-2/15 px-3 py-1 text-[11px] text-fz-fg hover:bg-fz-accent-2/30 disabled:opacity-50"
          >
            {generating ? 'Building…' : 'Set pace & plan'}
          </button>
        </div>
      </div>
    </div>
  )
}
