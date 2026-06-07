import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_STUDY_PACK_OPTIONS,
  QUIZ_CATEGORIES,
  QUIZ_CATEGORY_LABELS,
  STUDY_PACK_LIMITS,
  categoriesForGenre,
  type DocumentGenre,
  type QuizCategory,
  type QuizDifficulty,
  type QuizFormat,
  type StudyPackOptions
} from '@shared/types/database'
import { Button, Modal, Section, Slider } from '../ui'
import { cn } from '../../lib/cn'
import { useStudyPackStore } from '../../state/studyPackStore'
import { useStudyPackPrefsStore } from '../../state/studyPackPrefsStore'

const DIFFICULTY_OPTIONS: Array<{ value: QuizDifficulty; label: string }> = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' }
]

const FORMAT_OPTIONS: Array<{ value: QuizFormat; label: string }> = [
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'short_answer', label: 'Short answer' },
  { value: 'true_false', label: 'True / false' }
]

// A toggle pill used for multi-select groups (difficulty / format / category).
function Chip({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-md border px-2.5 py-1 text-fz-ui transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fz-accent',
        active
          ? 'border-fz-accent-2/60 bg-fz-accent-2/20 text-fz-fg'
          : 'border-fz-border bg-fz-bg text-fz-fg-muted hover:text-fz-fg'
      )}
    >
      {label}
    </button>
  )
}

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]
}

export function StudyPackOptionsModal({
  documentId,
  onClose
}: {
  documentId: string
  onClose: () => void
}): React.JSX.Element {
  const generating = useStudyPackStore((s) => s.generating)
  const generate = useStudyPackStore((s) => s.generate)
  const error = useStudyPackStore((s) => s.error)
  const prefs = useStudyPackPrefsStore((s) => s.prefs)
  const prefsLoaded = useStudyPackPrefsStore((s) => s.loaded)
  const loadPrefs = useStudyPackPrefsStore((s) => s.load)
  const setPrefs = useStudyPackPrefsStore((s) => s.set)

  const [opts, setOpts] = useState<StudyPackOptions>(DEFAULT_STUDY_PACK_OPTIONS)
  const [genre, setGenre] = useState<DocumentGenre | null>(null)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [docLoaded, setDocLoaded] = useState(false)
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    if (!prefsLoaded) void loadPrefs()
  }, [prefsLoaded, loadPrefs])

  // Pull genre + page count so categories adapt and page-range bounds are real.
  useEffect(() => {
    let cancelled = false
    window.fuzzy.documents
      .get(documentId)
      .then((doc) => {
        if (cancelled) return
        setGenre(doc?.genre ?? null)
        setPageCount(doc?.pageCount ?? null)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setDocLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [documentId])

  // Seed once, only after BOTH prefs and the document (its genre) have loaded —
  // otherwise the genre-adaptive category seed would race the doc fetch. Start
  // from last-used prefs, but if the user never customized categories (still the
  // ['general'] default), adopt the genre-adaptive set.
  useEffect(() => {
    if (seeded || !prefsLoaded || !docLoaded) return
    const base = prefs.lastOptions
    const isDefaultCats = base.categories.length === 1 && base.categories[0] === 'general'
    setOpts({
      ...base,
      categories: isDefaultCats ? categoriesForGenre(genre) : base.categories
    })
    setSeeded(true)
  }, [seeded, prefsLoaded, docLoaded, prefs.lastOptions, genre])

  const recommended = useMemo(() => categoriesForGenre(genre), [genre])
  const otherCats = useMemo(
    () => QUIZ_CATEGORIES.filter((c) => !recommended.includes(c)),
    [recommended]
  )

  const valid =
    opts.difficulties.length > 0 && opts.formats.length > 0 && opts.categories.length > 0

  const handleGenerate = async (): Promise<void> => {
    if (!valid) return
    void setPrefs({ lastOptions: opts })
    const pack = await generate(documentId, opts)
    if (pack) onClose()
  }

  const renderCategoryChip = (c: QuizCategory): React.JSX.Element => (
    <Chip
      key={c}
      label={QUIZ_CATEGORY_LABELS[c]}
      active={opts.categories.includes(c)}
      onClick={() => setOpts((o) => ({ ...o, categories: toggle(o.categories, c) }))}
    />
  )

  const pageMax = pageCount ?? 9999

  return (
    <Modal
      title="Build a study pack"
      description="Tune what gets generated — difficulty, question types, content focus, and scope."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleGenerate} loading={generating} disabled={!valid}>
            {generating ? 'Generating…' : 'Generate'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Section title="Difficulty" description="Which levels to mix into the quiz.">
          <div className="flex flex-wrap gap-1.5">
            {DIFFICULTY_OPTIONS.map((d) => (
              <Chip
                key={d.value}
                label={d.label}
                active={opts.difficulties.includes(d.value)}
                onClick={() =>
                  setOpts((o) => ({ ...o, difficulties: toggle(o.difficulties, d.value) }))
                }
              />
            ))}
          </div>
        </Section>

        <Section title="Question formats" description="Multiple-choice & true/false are auto-graded.">
          <div className="flex flex-wrap gap-1.5">
            {FORMAT_OPTIONS.map((f) => (
              <Chip
                key={f.value}
                label={f.label}
                active={opts.formats.includes(f.value)}
                onClick={() => setOpts((o) => ({ ...o, formats: toggle(o.formats, f.value) }))}
              />
            ))}
          </div>
        </Section>

        <Section
          title="Content focus"
          description={
            genre
              ? `Recommended for ${genre}. Ask about tone, plot, arguments — whatever matters.`
              : 'What the questions should be about — tone, plot, arguments, and more.'
          }
        >
          <div className="flex flex-wrap gap-1.5">{recommended.map(renderCategoryChip)}</div>
          {otherCats.length > 0 && (
            <>
              <p className="mt-2 text-fz-micro text-fz-fg-subtle">More categories</p>
              <div className="flex flex-wrap gap-1.5">{otherCats.map(renderCategoryChip)}</div>
            </>
          )}
        </Section>

        <Section title="How many" description="Cards and questions to generate.">
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-fz-ui text-fz-fg-muted">
                <span>Quiz questions</span>
                <span className="text-fz-fg">{opts.quizCount}</span>
              </div>
              <Slider
                aria-label="Quiz questions"
                min={STUDY_PACK_LIMITS.quizCount.min}
                max={STUDY_PACK_LIMITS.quizCount.max}
                value={opts.quizCount}
                onChange={(v) => setOpts((o) => ({ ...o, quizCount: v }))}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-fz-ui text-fz-fg-muted">
                <span>Flashcards</span>
                <span className="text-fz-fg">{opts.flashcardCount}</span>
              </div>
              <Slider
                aria-label="Flashcards"
                min={STUDY_PACK_LIMITS.flashcardCount.min}
                max={STUDY_PACK_LIMITS.flashcardCount.max}
                value={opts.flashcardCount}
                onChange={(v) => setOpts((o) => ({ ...o, flashcardCount: v }))}
              />
            </div>
          </div>
        </Section>

        <Section title="Card style">
          <label className="flex cursor-pointer items-center gap-2 text-fz-ui text-fz-fg-muted">
            <input
              type="checkbox"
              checked={opts.includeCloze}
              onChange={(e) => setOpts((o) => ({ ...o, includeCloze: e.target.checked }))}
              className="accent-fz-accent-2"
            />
            Include cloze (fill-in-the-blank) flashcards
          </label>
        </Section>

        <Section title="Scope" description="Generate from the whole document or a page range.">
          <label className="flex cursor-pointer items-center gap-2 text-fz-ui text-fz-fg-muted">
            <input
              type="checkbox"
              checked={opts.pageRange !== null}
              onChange={(e) =>
                setOpts((o) => ({
                  ...o,
                  pageRange: e.target.checked ? { start: 1, end: Math.min(pageMax, 20) } : null
                }))
              }
              className="accent-fz-accent-2"
            />
            Limit to a page range{pageCount ? ` (1–${pageCount})` : ''}
          </label>
          {opts.pageRange && (
            <div className="mt-2 flex items-center gap-2 text-fz-ui text-fz-fg-muted">
              <span>Pages</span>
              <input
                type="number"
                min={1}
                max={pageMax}
                value={opts.pageRange.start}
                onChange={(e) =>
                  setOpts((o) => ({
                    ...o,
                    pageRange: { start: Number(e.target.value) || 1, end: o.pageRange?.end ?? 1 }
                  }))
                }
                className="w-16 rounded border border-fz-border bg-fz-bg px-2 py-1 text-fz-fg focus:border-fz-accent focus:outline-none"
              />
              <span>to</span>
              <input
                type="number"
                min={1}
                max={pageMax}
                value={opts.pageRange.end}
                onChange={(e) =>
                  setOpts((o) => ({
                    ...o,
                    pageRange: { start: o.pageRange?.start ?? 1, end: Number(e.target.value) || 1 }
                  }))
                }
                className="w-16 rounded border border-fz-border bg-fz-bg px-2 py-1 text-fz-fg focus:border-fz-accent focus:outline-none"
              />
            </div>
          )}
        </Section>

        <Section title="Focus (optional)" description="A nudge for the model, e.g. “emphasize the protagonist's motivation”.">
          <textarea
            value={opts.focusNote ?? ''}
            onChange={(e) => setOpts((o) => ({ ...o, focusNote: e.target.value }))}
            placeholder="Anything specific you want the questions to emphasize…"
            rows={2}
            className="w-full resize-none rounded-md border border-fz-border bg-fz-bg px-2.5 py-2 text-fz-ui leading-relaxed text-fz-fg placeholder:text-fz-fg-subtle focus:border-fz-accent focus:outline-none"
          />
        </Section>

        {!valid && (
          <p className="text-fz-micro text-fz-warning">
            Pick at least one difficulty, format, and content category.
          </p>
        )}
        {error && <p className="text-fz-micro text-fz-danger">{error}</p>}
      </div>
    </Modal>
  )
}
