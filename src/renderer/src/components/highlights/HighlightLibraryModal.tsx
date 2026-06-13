import { useEffect, useMemo, useState } from 'react'
import type { HighlightExportTarget, HighlightRecord, ReviewGrade } from '@shared/types/database'
import { useHighlightStore } from '../../state/highlightStore'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Panel } from '../ui/Panel'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Textarea } from '../ui/Textarea'

type HighlightTab = 'library' | 'review'

const EXPORT_TARGETS: Array<{ value: HighlightExportTarget; label: string }> = [
  { value: 'notion', label: 'Notion' },
  { value: 'obsidian', label: 'Obsidian' },
  { value: 'logseq', label: 'Logseq' },
  { value: 'roam', label: 'Roam' },
  { value: 'evernote', label: 'Evernote' },
  { value: 'json', label: 'JSON' }
]

const REVIEW_BUTTONS: Array<{ grade: ReviewGrade; label: string }> = [
  { grade: 'again', label: 'Again' },
  { grade: 'hard', label: 'Hard' },
  { grade: 'good', label: 'Good' },
  { grade: 'easy', label: 'Easy' }
]

export function HighlightLibraryModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const items = useHighlightStore((s) => s.items)
  const dueItems = useHighlightStore((s) => s.dueItems)
  const stats = useHighlightStore((s) => s.stats)
  const filters = useHighlightStore((s) => s.filters)
  const loading = useHighlightStore((s) => s.loading)
  const dueLoading = useHighlightStore((s) => s.dueLoading)
  const importing = useHighlightStore((s) => s.importing)
  const error = useHighlightStore((s) => s.error)
  const load = useHighlightStore((s) => s.load)
  const loadDue = useHighlightStore((s) => s.loadDue)
  const loadStats = useHighlightStore((s) => s.loadStats)
  const importHighlights = useHighlightStore((s) => s.importHighlights)
  const createManual = useHighlightStore((s) => s.createManual)
  const exportHighlights = useHighlightStore((s) => s.exportHighlights)

  const [tab, setTab] = useState<HighlightTab>('library')
  const [query, setQuery] = useState(filters.query ?? '')
  const [favoritesOnly, setFavoritesOnly] = useState(Boolean(filters.favoritesOnly))
  const [selectedTag, setSelectedTag] = useState<string | null>(
    filters.tags && filters.tags.length > 0 ? filters.tags[0] : null
  )
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickText, setQuickText] = useState('')
  const [quickNote, setQuickNote] = useState('')
  const [quickTags, setQuickTags] = useState('')
  const [savingQuickAdd, setSavingQuickAdd] = useState(false)

  useEffect(() => {
    void Promise.all([load(), loadDue(), loadStats()])
  }, [load, loadDue, loadStats])

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load({
        query,
        favoritesOnly,
        tags: selectedTag ? [selectedTag] : [],
        dueOnly: false
      })
    }, 140)
    return () => window.clearTimeout(id)
  }, [favoritesOnly, load, query, selectedTag])

  const dueCount = stats?.dueCount ?? dueItems.length
  const tagChips = useMemo(() => stats?.topTags ?? [], [stats?.topTags])

  const onQuickSave = async (): Promise<void> => {
    setSavingQuickAdd(true)
    try {
      await createManual({
        sourceTitle: quickTitle,
        text: quickText,
        note: quickNote,
        tags: quickTags
          .split(/[;,]/)
          .map((tag) => tag.trim())
          .filter(Boolean)
      })
      setQuickTitle('')
      setQuickText('')
      setQuickNote('')
      setQuickTags('')
      setShowQuickAdd(false)
    } finally {
      setSavingQuickAdd(false)
    }
  }

  return (
    <Modal
      title="Highlights"
      description="A cross-source memory layer for saved highlights, resurfaced with spaced repetition."
      size="lg"
      className="w-[960px]"
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Highlights" value={String(stats?.total ?? items.length)} />
          <StatCard label="Due today" value={String(dueCount)} accent={dueCount > 0} />
          <StatCard label="Favorites" value={String(stats?.favoriteCount ?? 0)} />
          <StatCard label="Sources" value={String(stats?.sourceCount ?? 0)} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            aria-label="Highlight view"
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'library', label: 'Library' },
              { value: 'review', label: `Daily Review${dueCount > 0 ? ` (${dueCount})` : ''}` }
            ]}
          />
          <Button size="sm" variant="primary" loading={importing} onClick={() => void importHighlights()}>
            Import highlights
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowQuickAdd((open) => !open)}>
            {showQuickAdd ? 'Hide quick add' : 'Quick add'}
          </Button>
          {EXPORT_TARGETS.map((target) => (
            <Button
              key={target.value}
              size="sm"
              variant="ghost"
              onClick={() => void exportHighlights(target.value)}
            >
              {target.label}
            </Button>
          ))}
        </div>

        {showQuickAdd && (
          <Panel className="space-y-3 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Source title"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
              />
              <Input
                placeholder="Tags (comma separated)"
                value={quickTags}
                onChange={(e) => setQuickTags(e.target.value)}
              />
            </div>
            <Textarea
              rows={4}
              autoGrow
              placeholder="Highlight text"
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
            />
            <Textarea
              rows={2}
              autoGrow
              placeholder="Optional note"
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="primary"
                loading={savingQuickAdd}
                onClick={() => void onQuickSave()}
                disabled={!quickTitle.trim() || !quickText.trim()}
              >
                Save highlight
              </Button>
            </div>
          </Panel>
        )}

        {error && <Panel className="border-fz-danger/40 bg-fz-danger/10 p-3 text-fz-ui text-fz-danger">{error}</Panel>}

        {tab === 'library' ? (
          <>
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                placeholder="Search highlights, notes, titles, and tags"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button
                size="sm"
                variant={favoritesOnly ? 'primary' : 'secondary'}
                onClick={() => setFavoritesOnly((value) => !value)}
              >
                Favorites only
              </Button>
            </div>
            {tagChips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tagChips.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag((current) => (current === tag ? null : tag))}
                    className={[
                      'rounded-full border px-2 py-1 text-fz-micro transition',
                      selectedTag === tag
                        ? 'border-fz-accent bg-fz-accent/15 text-fz-fg'
                        : 'border-fz-border text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg'
                    ].join(' ')}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-3">
              {loading ? (
                <Panel className="p-4 text-center text-fz-ui text-fz-fg-muted">Loading highlights…</Panel>
              ) : items.length === 0 ? (
                <Panel className="p-4 text-center text-fz-ui text-fz-fg-muted">
                  Import Kindle clippings, Instapaper exports, Apple Books exports, or generic CSV/JSON highlight dumps to start your library.
                </Panel>
              ) : (
                items.map((highlight) => <HighlightCard key={highlight.id} highlight={highlight} />)
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {dueLoading ? (
              <Panel className="p-4 text-center text-fz-ui text-fz-fg-muted">Building today’s review…</Panel>
            ) : dueItems.length === 0 ? (
              <Panel className="p-4 text-center text-fz-ui text-fz-fg-muted">
                Nothing due right now. New highlights will resurface here automatically.
              </Panel>
            ) : (
              dueItems.map((highlight) => (
                <Panel key={highlight.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-fz-ui font-semibold text-fz-fg">
                        {highlight.sourceTitle}
                      </div>
                      <div className="text-fz-micro text-fz-fg-subtle">
                        {highlight.sourceLabel}
                        {highlight.sourceLocation ? ` · ${highlight.sourceLocation}` : ''}
                      </div>
                    </div>
                    {highlight.isFavorite && (
                      <span className="rounded-full border border-fz-accent/40 bg-fz-accent/10 px-2 py-0.5 text-fz-micro text-fz-fg">
                        Favorite
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-fz-body leading-relaxed text-fz-fg">
                    {highlight.text}
                  </p>
                  {highlight.note.trim() && (
                    <p className="rounded-md bg-fz-bg px-3 py-2 text-fz-ui text-fz-fg-muted">
                      {highlight.note.trim()}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {REVIEW_BUTTONS.map((button) => (
                      <Button
                        key={button.grade}
                        size="sm"
                        variant={button.grade === 'good' ? 'primary' : 'secondary'}
                        onClick={() => void useHighlightStore.getState().gradeHighlight(highlight.id, button.grade)}
                      >
                        {button.label}
                      </Button>
                    ))}
                  </div>
                </Panel>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

function StatCard({
  label,
  value,
  accent = false
}: {
  label: string
  value: string
  accent?: boolean
}): React.JSX.Element {
  return (
    <Panel className="p-3">
      <div className={`text-fz-title font-semibold ${accent ? 'text-fz-accent' : 'text-fz-fg'}`}>
        {value}
      </div>
      <div className="text-fz-micro uppercase tracking-wider text-fz-fg-subtle">{label}</div>
    </Panel>
  )
}

function HighlightCard({ highlight }: { highlight: HighlightRecord }): React.JSX.Element {
  const updateHighlight = useHighlightStore((s) => s.updateHighlight)
  const deleteHighlight = useHighlightStore((s) => s.deleteHighlight)
  const [note, setNote] = useState(highlight.note)
  const [tags, setTags] = useState(highlight.tags.join(', '))

  useEffect(() => setNote(highlight.note), [highlight.id, highlight.note])
  useEffect(() => setTags(highlight.tags.join(', ')), [highlight.id, highlight.tags])

  return (
    <Panel className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-fz-ui font-semibold text-fz-fg">{highlight.sourceTitle}</div>
          <div className="text-fz-micro text-fz-fg-subtle">
            {highlight.sourceLabel}
            {highlight.sourceAuthor ? ` · ${highlight.sourceAuthor}` : ''}
            {highlight.sourceLocation ? ` · ${highlight.sourceLocation}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={highlight.isFavorite ? 'primary' : 'secondary'}
            onClick={() =>
              void updateHighlight(highlight.id, {
                isFavorite: !highlight.isFavorite
              })
            }
          >
            {highlight.isFavorite ? 'Favorited' : 'Favorite'}
          </Button>
          <Button size="sm" variant="danger" onClick={() => void deleteHighlight(highlight.id)}>
            Delete
          </Button>
        </div>
      </div>

      <p className="whitespace-pre-wrap text-fz-body leading-relaxed text-fz-fg">{highlight.text}</p>

      <div className="grid gap-3 md:grid-cols-2">
        <Textarea
          rows={3}
          autoGrow
          placeholder="Your note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => void updateHighlight(highlight.id, { note })}
        />
        <Input
          placeholder="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          onBlur={() =>
            void updateHighlight(highlight.id, {
              tags: tags
                .split(/[;,]/)
                .map((tag) => tag.trim())
                .filter(Boolean)
            })
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-fz-micro text-fz-fg-subtle">
        <span>Next review: {formatDue(highlight.review.dueAt)}</span>
        {highlight.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-fz-border px-2 py-0.5">
            #{tag}
          </span>
        ))}
      </div>
    </Panel>
  )
}

function formatDue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'soon'
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}
