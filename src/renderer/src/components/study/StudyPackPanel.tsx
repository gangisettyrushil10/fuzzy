import { useEffect, useMemo, useState } from 'react'
import { useStudyPackStore } from '../../state/studyPackStore'
import { useSettingsStore } from '../../state/settingsStore'
import { toast } from '../../state/toastStore'
import { cn } from '../../lib/cn'
import type {
  Flashcard,
  QuizQuestion,
  ReviewGrade,
  StudyExportFormat,
  StudyPackOptions,
  StudyPackRecord
} from '@shared/types/database'
import { StudyPackOptionsModal } from './StudyPackOptionsModal'

type Tab = 'summary' | 'concepts' | 'flashcards' | 'quiz'

function summarizeOptions(options: StudyPackOptions | null): string {
  if (!options) return 'classic'
  const fmt = options.formats
    .map((f) => (f === 'multiple_choice' ? 'MCQ' : f === 'true_false' ? 'T/F' : 'SA'))
    .join('/')
  return `${options.quizCount} Q · ${options.flashcardCount} cards · ${fmt}`
}

function timeAgoLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function StudyPackPanel({
  documentId,
  onClose
}: {
  documentId: string
  onClose: () => void
}): React.JSX.Element {
  const pack = useStudyPackStore((s) => s.pack)
  const packs = useStudyPackStore((s) => s.packs)
  const loading = useStudyPackStore((s) => s.loading)
  const generating = useStudyPackStore((s) => s.generating)
  const error = useStudyPackStore((s) => s.error)
  const attemptStats = useStudyPackStore((s) => s.attemptStats)
  const loadFor = useStudyPackStore((s) => s.loadFor)
  const selectPack = useStudyPackStore((s) => s.selectPack)
  const deletePack = useStudyPackStore((s) => s.deletePack)
  const optionsModalOpen = useStudyPackStore((s) => s.optionsModalOpen)
  const openOptions = useStudyPackStore((s) => s.openOptions)
  const closeOptions = useStudyPackStore((s) => s.closeOptions)
  const settings = useSettingsStore((s) => s.settings)

  const [tab, setTab] = useState<Tab>('summary')

  useEffect(() => {
    loadFor(documentId)
  }, [documentId, loadFor])

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-[680px] max-w-[92vw] flex-col rounded-lg border border-fz-border bg-fz-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-fz-border px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-fz-label font-semibold uppercase tracking-wider text-fz-fg-subtle">
              Study Pack
            </span>
            {pack && (
              <span className="truncate text-fz-ui text-fz-fg-muted" title={pack.title}>
                {pack.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {packs.length > 1 && pack && (
              <select
                value={pack.id}
                onChange={(e) => selectPack(e.target.value)}
                className="max-w-[180px] rounded border border-fz-border bg-fz-bg px-1.5 py-1 text-fz-micro text-fz-fg-muted focus:border-fz-accent focus:outline-none"
                title="Switch between saved study packs"
              >
                {packs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {timeAgoLabel(p.createdAt)} — {summarizeOptions(p.options)}
                  </option>
                ))}
              </select>
            )}
            {pack && <ExportMenu pack={pack} />}
            <button
              type="button"
              onClick={openOptions}
              disabled={generating}
              className="rounded border border-fz-accent-2/60 bg-fz-accent-2/15 px-2 py-1 text-fz-micro uppercase tracking-wider text-fz-fg hover:bg-fz-accent-2/30 disabled:opacity-50"
              title={
                settings?.providerMode === 'openai' && settings.hasOpenaiKey
                  ? 'Configure & generate with OpenAI'
                  : 'Configure & generate (mock — switch to OpenAI in Settings for the real thing)'
              }
            >
              {generating ? 'Generating…' : pack ? 'New pack' : 'Generate'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-fz-border px-2 py-1 text-fz-micro uppercase tracking-wider text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg"
            >
              Close
            </button>
          </div>
        </header>

        <nav className="flex h-9 shrink-0 items-center gap-1 border-b border-fz-border px-3">
          {(['summary', 'concepts', 'flashcards', 'quiz'] as const).map((t) => (
            <TabButton key={t} active={t === tab} onClick={() => setTab(t)} label={t} />
          ))}
          {pack && (
            <span className="ml-auto text-fz-micro text-fz-fg-subtle">
              {pack.flashcards.length} cards · {pack.quiz.length} questions
              {attemptStats && attemptStats.attempts > 0 && <> · best {attemptStats.bestPct}%</>}
            </span>
          )}
        </nav>

        <div className="fz-selectable min-h-0 flex-1 overflow-y-auto px-4 py-4 text-fz-ui leading-relaxed text-fz-fg">
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
          {pack && (
            <PackBody
              pack={pack}
              tab={tab}
              documentId={documentId}
              onDelete={() => deletePack(pack.id)}
              canDelete={packs.length > 1}
            />
          )}
        </div>
      </div>

      {optionsModalOpen && (
        <StudyPackOptionsModal documentId={documentId} onClose={closeOptions} />
      )}
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
      className={cn(
        'rounded px-2 py-1 text-fz-micro uppercase tracking-wider',
        active ? 'bg-fz-accent-2/20 text-fz-fg' : 'text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg'
      )}
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
        configure difficulty, question types, and content focus, then build one from the indexed
        pages.
      </p>
      <p className="text-fz-micro text-fz-fg-subtle">
        Provider: {providerLabel}. Switch in Settings.
      </p>
    </div>
  )
}

// --------------------------------------------------------------------------
// Export menu
// --------------------------------------------------------------------------
function ExportMenu({ pack }: { pack: StudyPackRecord }): React.JSX.Element {
  const [open, setOpen] = useState(false)

  const copyText = async (format: StudyExportFormat, andOpenQuizlet = false): Promise<void> => {
    try {
      const text = await window.fuzzy.studyPacks.exportText(pack.id, format)
      await navigator.clipboard.writeText(text)
      if (andOpenQuizlet) {
        await window.fuzzy.studyPacks.openQuizletCreate()
        toast.success('Copied — paste into Quizlet (opened in your browser)')
      } else {
        toast.success('Copied to clipboard')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setOpen(false)
    }
  }

  const saveFile = async (format: StudyExportFormat): Promise<void> => {
    try {
      const res = await window.fuzzy.studyPacks.exportFile(pack.id, format)
      if (res.ok) toast.success('Saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded border border-fz-border px-2 py-1 text-fz-micro uppercase tracking-wider text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg"
        title="Export this study pack"
      >
        Export
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-fz-border bg-fz-surface p-1 shadow-xl">
            <MenuItem label="Copy for Quizlet & open" onClick={() => copyText('quizlet', true)} />
            <MenuItem label="Copy for Anki" onClick={() => copyText('anki')} />
            <div className="my-1 border-t border-fz-border" />
            <MenuItem label="Save as CSV…" onClick={() => saveFile('csv')} />
            <MenuItem label="Save as Markdown…" onClick={() => saveFile('markdown')} />
            <MenuItem label="Save for Anki…" onClick={() => saveFile('anki')} />
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded px-2 py-1.5 text-left text-fz-ui text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg"
    >
      {label}
    </button>
  )
}

// --------------------------------------------------------------------------
// Pack body — routes the active tab
// --------------------------------------------------------------------------
function PackBody({
  pack,
  tab,
  documentId,
  onDelete,
  canDelete
}: {
  pack: StudyPackRecord
  tab: Tab
  documentId: string
  onDelete: () => void
  canDelete: boolean
}): React.JSX.Element {
  if (tab === 'summary') {
    return (
      <div className="space-y-3">
        <div className="whitespace-pre-wrap text-fz-fg">
          {pack.summary ?? <span className="text-fz-fg-muted">(no summary)</span>}
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-fz-micro text-fz-fg-subtle hover:text-fz-danger"
          >
            Delete this pack
          </button>
        )}
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
    return <FlashcardsTab pack={pack} documentId={documentId} />
  }
  // quiz
  if (pack.quiz.length === 0) {
    return <div className="text-fz-fg-muted">No quiz questions.</div>
  }
  return <QuizTab pack={pack} documentId={documentId} />
}

// --------------------------------------------------------------------------
// Flashcards: preview + spaced-repetition study mode
// --------------------------------------------------------------------------
function FlashcardsTab({
  pack,
  documentId
}: {
  pack: StudyPackRecord
  documentId: string
}): React.JSX.Element {
  const [studying, setStudying] = useState(false)
  if (studying) {
    return <FlashcardReview pack={pack} documentId={documentId} onExit={() => setStudying(false)} />
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-fz-micro text-fz-fg-subtle">{pack.flashcards.length} cards</span>
        <button
          type="button"
          onClick={() => setStudying(true)}
          className="rounded border border-fz-accent-2/60 bg-fz-accent-2/15 px-2.5 py-1 text-fz-micro uppercase tracking-wider text-fz-fg hover:bg-fz-accent-2/30"
        >
          Study (spaced repetition)
        </button>
      </div>
      <div className="space-y-3">
        {pack.flashcards.map((f, i) => (
          <FlashcardPreview key={i} card={f} />
        ))}
      </div>
    </div>
  )
}

function renderCardFront(card: Flashcard): React.JSX.Element {
  if (card.kind === 'cloze') {
    return (
      <div className="text-fz-fg">
        <span className="mr-1.5 rounded bg-fz-accent-2/20 px-1 py-0.5 text-[10px] uppercase tracking-wider text-fz-fg-subtle">
          cloze
        </span>
        {card.question}
      </div>
    )
  }
  return <div className="text-fz-fg">{card.question}</div>
}

function FlashcardPreview({ card }: { card: Flashcard }): React.JSX.Element {
  const [revealed, setRevealed] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setRevealed((r) => !r)}
      className="block w-full rounded border border-fz-border bg-fz-bg/40 px-3 py-2 text-left hover:bg-fz-bg/60"
    >
      {renderCardFront(card)}
      <div className="mt-1 text-fz-micro text-fz-fg-muted">
        {revealed ? card.answer : 'Click to reveal answer'}
      </div>
    </button>
  )
}

const GRADE_BUTTONS: Array<{ grade: ReviewGrade; label: string; cls: string }> = [
  {
    grade: 'again',
    label: 'Again',
    cls: 'border-fz-danger/50 text-fz-danger hover:bg-fz-danger/10'
  },
  { grade: 'hard', label: 'Hard', cls: 'border-fz-border text-fz-fg-muted hover:bg-fz-bg' },
  { grade: 'good', label: 'Good', cls: 'border-fz-border text-fz-fg-muted hover:bg-fz-bg' },
  {
    grade: 'easy',
    label: 'Easy',
    cls: 'border-fz-accent-2/60 bg-fz-accent-2/15 text-fz-fg hover:bg-fz-accent-2/30'
  }
]

function FlashcardReview({
  pack,
  documentId,
  onExit
}: {
  pack: StudyPackRecord
  documentId: string
  onExit: () => void
}): React.JSX.Element {
  // Order cards due-first using the persisted SM-2 schedule.
  const [order, setOrder] = useState<number[]>(() => pack.flashcards.map((_, i) => i))
  const [pos, setPos] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    window.fuzzy.flashcardReviews
      .forPack(pack.id)
      .then((reviews) => {
        if (cancelled) return
        const now = new Date().toISOString()
        const due: number[] = []
        const later: number[] = []
        pack.flashcards.forEach((_, i) => {
          const r = reviews[i]
          if (!r || r.dueAt <= now) due.push(i)
          else later.push(i)
        })
        setOrder([...due, ...later])
        setPos(0)
        setRevealed(false)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [pack.id, pack.flashcards])

  const cardIndex = order[pos]
  const card = pack.flashcards[cardIndex]
  const done = pos >= order.length

  const handleGrade = async (grade: ReviewGrade): Promise<void> => {
    try {
      await window.fuzzy.flashcardReviews.grade(pack.id, documentId, cardIndex, grade)
    } catch {
      /* keep going; schedule will resync next open */
    }
    setReviewedCount((c) => c + 1)
    setRevealed(false)
    setPos((p) => p + 1)
  }

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="text-fz-title font-semibold text-fz-fg">Review complete</div>
        <p className="text-fz-ui text-fz-fg-muted">
          You reviewed {reviewedCount} card{reviewedCount === 1 ? '' : 's'}. Come back when they’re
          due again.
        </p>
        <button
          type="button"
          onClick={onExit}
          className="rounded border border-fz-border px-3 py-1 text-fz-ui text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg"
        >
          Back to cards
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between text-fz-micro text-fz-fg-subtle">
        <span>
          Card {pos + 1} of {order.length}
        </span>
        <button type="button" onClick={onExit} className="hover:text-fz-fg">
          Exit
        </button>
      </div>
      <div className="flex flex-1 flex-col justify-center rounded-lg border border-fz-border bg-fz-bg/40 p-6">
        {renderCardFront(card)}
        {revealed && (
          <div className="mt-4 border-t border-fz-border pt-4 text-fz-fg-muted">{card.answer}</div>
        )}
      </div>
      <div className="mt-3">
        {!revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="w-full rounded border border-fz-border bg-fz-bg/40 py-2 text-fz-ui text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg"
          >
            Show answer
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {GRADE_BUTTONS.map((g) => (
              <button
                key={g.grade}
                type="button"
                onClick={() => handleGrade(g.grade)}
                className={cn('rounded border py-2 text-fz-ui transition', g.cls)}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
// Quiz: preview + interactive auto-graded runner
// --------------------------------------------------------------------------
function difficultyTone(d: QuizQuestion['difficulty']): string {
  if (d === 'easy') return 'text-fz-success'
  if (d === 'hard') return 'text-fz-danger'
  return 'text-fz-warning'
}

function QuizTab({
  pack,
  documentId
}: {
  pack: StudyPackRecord
  documentId: string
}): React.JSX.Element {
  const refreshStats = useStudyPackStore((s) => s.refreshStats)
  const attemptStats = useStudyPackStore((s) => s.attemptStats)
  const [running, setRunning] = useState(false)

  if (running) {
    return (
      <QuizRunner
        pack={pack}
        onExit={() => setRunning(false)}
        onComplete={() => refreshStats(documentId)}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-fz-micro text-fz-fg-subtle">
          {pack.quiz.length} questions
          {attemptStats && attemptStats.attempts > 0 && (
            <>
              {' '}
              · {attemptStats.attempts} attempt{attemptStats.attempts === 1 ? '' : 's'} · best{' '}
              {attemptStats.bestPct}% · last {attemptStats.lastPct}%
            </>
          )}
        </span>
        <button
          type="button"
          onClick={() => setRunning(true)}
          className="rounded border border-fz-accent-2/60 bg-fz-accent-2/15 px-2.5 py-1 text-fz-micro uppercase tracking-wider text-fz-fg hover:bg-fz-accent-2/30"
        >
          Start quiz
        </button>
      </div>
      <ol className="space-y-3">
        {pack.quiz.map((q, i) => (
          <li key={i} className="rounded border border-fz-border bg-fz-bg/40 px-3 py-2">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider">
              <span className={difficultyTone(q.difficulty)}>{q.difficulty}</span>
              {q.category && <span className="text-fz-fg-subtle">· {q.category}</span>}
              {q.format && q.format !== 'short_answer' && (
                <span className="text-fz-fg-subtle">
                  · {q.format === 'multiple_choice' ? 'choice' : 'true/false'}
                </span>
              )}
            </div>
            <div className="mb-2 text-fz-fg">{q.question}</div>
            <details>
              <summary className="cursor-pointer text-fz-micro text-fz-fg-muted hover:text-fz-fg">
                Show answer
              </summary>
              <div className="mt-1 text-fz-fg-muted">{q.answer}</div>
            </details>
          </li>
        ))}
      </ol>
    </div>
  )
}

interface RunnerAnswer {
  questionIndex: number
  given: string
  correct: boolean
}

function QuizRunner({
  pack,
  onExit,
  onComplete
}: {
  pack: StudyPackRecord
  onExit: () => void
  onComplete: () => void
}): React.JSX.Element {
  const [startedAt] = useState(() => new Date().toISOString())
  const [pos, setPos] = useState(0)
  const [answers, setAnswers] = useState<RunnerAnswer[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [typed, setTyped] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [finished, setFinished] = useState(false)
  const [saved, setSaved] = useState(false)

  const q = pack.quiz[pos]
  const isChoice =
    q && (q.format === 'multiple_choice' || q.format === 'true_false') && Array.isArray(q.choices)

  const score = useMemo(() => answers.filter((a) => a.correct).length, [answers])

  const saveAttempt = async (final: RunnerAnswer[]): Promise<void> => {
    if (saved) return
    setSaved(true)
    try {
      await window.fuzzy.quizAttempts.save({
        studyPackId: pack.id,
        documentId: pack.documentId,
        score: final.filter((a) => a.correct).length,
        total: pack.quiz.length,
        answers: final,
        startedAt
      })
      onComplete()
    } catch {
      /* non-fatal */
    }
  }

  const recordAndNext = (answer: RunnerAnswer): void => {
    const next = [...answers, answer]
    setAnswers(next)
    setSelected(null)
    setTyped('')
    setRevealed(false)
    if (pos + 1 >= pack.quiz.length) {
      setFinished(true)
      void saveAttempt(next)
    } else {
      setPos((p) => p + 1)
    }
  }

  if (finished) {
    const pct = pack.quiz.length ? Math.round((score / pack.quiz.length) * 100) : 0
    return (
      <div className="flex h-full flex-col">
        <div className="mb-3 text-center">
          <div className="text-fz-title font-semibold text-fz-fg">
            {score} / {pack.quiz.length} · {pct}%
          </div>
          <p className="text-fz-ui text-fz-fg-muted">Quiz complete</p>
        </div>
        <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {pack.quiz.map((question, i) => {
            const a = answers[i]
            return (
              <li
                key={i}
                className={cn(
                  'rounded border px-3 py-2',
                  a?.correct
                    ? 'border-fz-success/40 bg-fz-success/5'
                    : 'border-fz-danger/40 bg-fz-danger/5'
                )}
              >
                <div className="text-fz-ui text-fz-fg">{question.question}</div>
                {a && !a.correct && (
                  <div className="mt-1 text-fz-micro text-fz-fg-muted">
                    Your answer: {a.given || '—'}
                  </div>
                )}
                <div className="mt-1 text-fz-micro text-fz-fg-subtle">Answer: {question.answer}</div>
              </li>
            )
          })}
        </ol>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onExit}
            className="rounded border border-fz-border px-3 py-1 text-fz-ui text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between text-fz-micro text-fz-fg-subtle">
        <span>
          Question {pos + 1} of {pack.quiz.length} · score {score}
        </span>
        <button type="button" onClick={onExit} className="hover:text-fz-fg">
          Exit
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider">
          <span className={difficultyTone(q.difficulty)}>{q.difficulty}</span>
          {q.category && <span className="text-fz-fg-subtle">· {q.category}</span>}
        </div>
        <div className="mb-4 text-fz-body text-fz-fg">{q.question}</div>

        {isChoice ? (
          <div className="space-y-2">
            {q.choices!.map((choice, ci) => {
              const isCorrect = ci === q.correctIndex
              const isPicked = ci === selected
              return (
                <button
                  key={ci}
                  type="button"
                  disabled={revealed}
                  onClick={() => setSelected(ci)}
                  className={cn(
                    'block w-full rounded border px-3 py-2 text-left text-fz-ui transition',
                    revealed && isCorrect && 'border-fz-success/60 bg-fz-success/10 text-fz-fg',
                    revealed &&
                      isPicked &&
                      !isCorrect &&
                      'border-fz-danger/60 bg-fz-danger/10 text-fz-fg',
                    !revealed && isPicked && 'border-fz-accent-2/60 bg-fz-accent-2/15 text-fz-fg',
                    !revealed && !isPicked && 'border-fz-border text-fz-fg-muted hover:bg-fz-bg'
                  )}
                >
                  <span className="mr-2 text-fz-fg-subtle">{String.fromCharCode(65 + ci)}.</span>
                  {choice}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={revealed}
              placeholder="Type your answer…"
              rows={3}
              className="w-full resize-none rounded-md border border-fz-border bg-fz-bg px-2.5 py-2 text-fz-ui leading-relaxed text-fz-fg placeholder:text-fz-fg-subtle focus:border-fz-accent focus:outline-none disabled:opacity-70"
            />
            {revealed && (
              <div className="rounded border border-fz-border bg-fz-bg/40 px-3 py-2 text-fz-ui text-fz-fg-muted">
                <span className="text-fz-fg-subtle">Model answer: </span>
                {q.answer}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3">
        {isChoice ? (
          !revealed ? (
            <button
              type="button"
              disabled={selected === null}
              onClick={() => setRevealed(true)}
              className="w-full rounded border border-fz-accent-2/60 bg-fz-accent-2/15 py-2 text-fz-ui text-fz-fg hover:bg-fz-accent-2/30 disabled:opacity-50"
            >
              Check
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                recordAndNext({
                  questionIndex: pos,
                  given: selected !== null ? q.choices![selected] : '',
                  correct: selected === q.correctIndex
                })
              }
              className="w-full rounded border border-fz-border bg-fz-bg/40 py-2 text-fz-ui text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg"
            >
              {pos + 1 >= pack.quiz.length ? 'Finish' : 'Next'}
            </button>
          )
        ) : !revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="w-full rounded border border-fz-accent-2/60 bg-fz-accent-2/15 py-2 text-fz-ui text-fz-fg hover:bg-fz-accent-2/30"
          >
            Reveal answer
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => recordAndNext({ questionIndex: pos, given: typed, correct: false })}
              className="rounded border border-fz-danger/50 py-2 text-fz-ui text-fz-danger hover:bg-fz-danger/10"
            >
              I missed it
            </button>
            <button
              type="button"
              onClick={() => recordAndNext({ questionIndex: pos, given: typed, correct: true })}
              className="rounded border border-fz-success/50 py-2 text-fz-ui text-fz-success hover:bg-fz-success/10"
            >
              I got it
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
