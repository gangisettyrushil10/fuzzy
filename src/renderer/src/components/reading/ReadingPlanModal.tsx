import { useState } from 'react'
import { useReadingSessionStore } from '../../state/readingSessionStore'

const PRESETS = [10, 20, 30, 45, 60, 90]

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

  const [minutes, setMinutes] = useState<number>(30)
  const [customInput, setCustomInput] = useState<string>('')

  const handleGenerate = async (): Promise<void> => {
    const useCustom = customInput.trim()
    const minutesToUse = useCustom ? Number(useCustom) : minutes
    if (!Number.isFinite(minutesToUse) || minutesToUse < 1) return
    const session = await createForActive(documentId, Math.round(minutesToUse))
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
          Fuzzy will split the document into deep-read, skim, and review-later sections to fit your
          budget.
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
        <div className="mb-4 flex items-center gap-2">
          <input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Custom minutes"
            inputMode="numeric"
            className="flex-1 rounded border border-fz-border bg-fz-bg px-2 py-1 text-xs text-fz-fg placeholder:text-fz-fg-subtle focus:border-fz-accent focus:outline-none"
          />
          <span className="text-[10px] text-fz-fg-subtle">min</span>
        </div>
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
            disabled={generating}
            className="rounded border border-fz-accent-2/60 bg-fz-accent-2/15 px-3 py-1 text-[11px] text-fz-fg hover:bg-fz-accent-2/30 disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Build plan'}
          </button>
        </div>
      </div>
    </div>
  )
}
