import { useEffect, useState } from 'react'
import { useStudyPackStore } from '../../state/studyPackStore'
import { useSettingsStore } from '../../state/settingsStore'
import type { StudyPackRecord } from '@shared/types/database'

type Tab = 'summary' | 'concepts' | 'flashcards' | 'quiz'

export function StudyPackPanel({
  documentId,
  onClose
}: {
  documentId: string
  onClose: () => void
}): React.JSX.Element {
  const pack = useStudyPackStore((s) => s.pack)
  const loading = useStudyPackStore((s) => s.loading)
  const generating = useStudyPackStore((s) => s.generating)
  const error = useStudyPackStore((s) => s.error)
  const loadFor = useStudyPackStore((s) => s.loadFor)
  const generateForActive = useStudyPackStore((s) => s.generateForActive)
  const settings = useSettingsStore((s) => s.settings)

  const [tab, setTab] = useState<Tab>('summary')

  useEffect(() => {
    loadFor(documentId)
  }, [documentId, loadFor])

  const handleGenerate = (): void => {
    generateForActive(documentId).catch((err) => console.error('[fuzzy] study pack', err))
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="flex h-[78vh] w-[640px] max-w-[92vw] flex-col rounded-lg border border-fz-border bg-fz-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-fz-border px-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-fz-fg-subtle">
              Study Pack
            </span>
            {pack && (
              <span className="truncate text-xs text-fz-fg-muted" title={pack.title}>
                {pack.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="rounded border border-fz-accent-2/60 bg-fz-accent-2/15 px-2 py-1 text-[10px] uppercase tracking-wider text-fz-fg hover:bg-fz-accent-2/30 disabled:opacity-50"
              title={
                settings?.providerMode === 'openai' && settings.hasOpenaiKey
                  ? 'Generate with OpenAI'
                  : 'Generate (mock — switch to OpenAI in Settings for the real thing)'
              }
            >
              {generating ? 'Generating…' : pack ? 'Regenerate' : 'Generate'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-fz-border px-2 py-1 text-[10px] uppercase tracking-wider text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg"
            >
              Close
            </button>
          </div>
        </header>

        <nav className="flex h-9 shrink-0 items-center gap-1 border-b border-fz-border px-3">
          {(['summary', 'concepts', 'flashcards', 'quiz'] as const).map((t) => (
            <TabButton key={t} active={t === tab} onClick={() => setTab(t)} label={t} />
          ))}
        </nav>

        <div className="fz-selectable min-h-0 flex-1 overflow-y-auto px-4 py-4 text-xs leading-relaxed text-fz-fg">
          {loading && <div className="text-fz-fg-muted">Loading study pack…</div>}
          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-red-300/80">
              {error}
            </div>
          )}
          {!loading && !pack && !error && (
            <EmptyPackState
              providerLabel={
                settings?.providerMode === 'openai' && settings.hasOpenaiKey
                  ? 'OpenAI'
                  : 'Mock provider'
              }
            />
          )}
          {pack && <PackBody pack={pack} tab={tab} />}
        </div>
      </div>
    </div>
  )
}

function TabButton({
  label,
  active,
  onClick
}: {
  label: Tab
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded px-2 py-1 text-[10px] uppercase tracking-wider',
        active ? 'bg-fz-accent-2/20 text-fz-fg' : 'text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg'
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function EmptyPackState({ providerLabel }: { providerLabel: string }): React.JSX.Element {
  return (
    <div className="max-w-md text-fz-fg-muted">
      <p className="mb-2">
        No study pack yet for this document. Click <span className="text-fz-fg">Generate</span> to
        build one from the indexed pages.
      </p>
      <p className="text-[11px] text-fz-fg-subtle">
        Provider: {providerLabel}. Switch in Settings.
      </p>
    </div>
  )
}

function PackBody({ pack, tab }: { pack: StudyPackRecord; tab: Tab }): React.JSX.Element {
  if (tab === 'summary') {
    return (
      <div className="whitespace-pre-wrap text-fz-fg">
        {pack.summary ?? <span className="text-fz-fg-muted">(no summary)</span>}
      </div>
    )
  }
  if (tab === 'concepts') {
    if (pack.keyConcepts.length === 0) {
      return <div className="text-fz-fg-muted">No key concepts extracted.</div>
    }
    return (
      <ul className="space-y-1">
        {pack.keyConcepts.map((c, i) => (
          <li key={i} className="rounded border border-fz-border bg-fz-bg/40 px-3 py-2">
            {c}
          </li>
        ))}
      </ul>
    )
  }
  if (tab === 'flashcards') {
    if (pack.flashcards.length === 0) {
      return <div className="text-fz-fg-muted">No flashcards.</div>
    }
    return (
      <div className="space-y-3">
        {pack.flashcards.map((f, i) => (
          <Flashcard key={i} question={f.question} answer={f.answer} />
        ))}
      </div>
    )
  }
  // quiz
  if (pack.quiz.length === 0) {
    return <div className="text-fz-fg-muted">No quiz questions.</div>
  }
  return (
    <ol className="space-y-3">
      {pack.quiz.map((q, i) => (
        <li key={i} className="rounded border border-fz-border bg-fz-bg/40 px-3 py-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-fz-fg-subtle">
              {q.difficulty}
            </span>
          </div>
          <div className="mb-2 text-fz-fg">{q.question}</div>
          <details>
            <summary className="cursor-pointer text-[11px] text-fz-fg-muted hover:text-fz-fg">
              Show answer
            </summary>
            <div className="mt-1 text-fz-fg-muted">{q.answer}</div>
          </details>
        </li>
      ))}
    </ol>
  )
}

function Flashcard({ question, answer }: { question: string; answer: string }): React.JSX.Element {
  const [revealed, setRevealed] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setRevealed((r) => !r)}
      className="block w-full rounded border border-fz-border bg-fz-bg/40 px-3 py-2 text-left hover:bg-fz-bg/60"
    >
      <div className="mb-1 text-fz-fg">{question}</div>
      <div className="text-[11px] text-fz-fg-muted">
        {revealed ? answer : 'Click to reveal answer'}
      </div>
    </button>
  )
}
