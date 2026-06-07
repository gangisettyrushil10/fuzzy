import { useEffect } from 'react'
import type { CitationFormat, EssaySection, ThesisScope } from '@shared/types/database'
import { useEssayStore } from '../../state/essayStore'
import { useCitationFormat } from '../../state/thesisStore'
import { useDocumentStore } from '../../state/documentStore'
import { Button, Card, Input, Modal, SegmentedControl, Textarea } from '../ui'
import { toast } from '../../state/toastStore'

const SCOPE_OPTIONS: ReadonlyArray<{ value: ThesisScope; label: string }> = [
  { value: 'library', label: 'Whole library' },
  { value: 'active', label: 'This document' }
]

// The writing surface: a thesis becomes an evidence-grounded outline (reusing
// the synthesis engine), each section drafts into a cited paragraph, and the
// whole thing compiles to a Markdown draft you can copy out.
export function EssayWorkspace({ onClose }: { onClose: () => void }): React.JSX.Element {
  const essays = useEssayStore((s) => s.essays)
  const activeId = useEssayStore((s) => s.activeId)
  const title = useEssayStore((s) => s.title)
  const thesis = useEssayStore((s) => s.thesis)
  const scope = useEssayStore((s) => s.scope)
  const outline = useEssayStore((s) => s.outline)
  const outlineStatus = useEssayStore((s) => s.outlineStatus)
  const draftingId = useEssayStore((s) => s.draftingId)
  const error = useEssayStore((s) => s.error)
  const load = useEssayStore((s) => s.load)
  const newEssay = useEssayStore((s) => s.newEssay)
  const open = useEssayStore((s) => s.open)
  const remove = useEssayStore((s) => s.remove)
  const setTitle = useEssayStore((s) => s.setTitle)
  const setThesis = useEssayStore((s) => s.setThesis)
  const setScope = useEssayStore((s) => s.setScope)
  const save = useEssayStore((s) => s.save)
  const generateOutline = useEssayStore((s) => s.generateOutline)
  const draftAll = useEssayStore((s) => s.draftAll)
  const compiledDraft = useEssayStore((s) => s.compiledDraft)

  const citationFormat = useCitationFormat()
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)

  useEffect(() => {
    void load()
  }, [load])

  const generating = outlineStatus === 'generating'

  const copyDraft = async (): Promise<void> => {
    const md = compiledDraft()
    if (!md.trim()) return
    try {
      await navigator.clipboard.writeText(md)
      toast.success('Draft copied as Markdown')
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <Modal title="Essay Workspace" size="lg" onClose={onClose}>
      <div className="flex max-h-[72vh] flex-col gap-3 overflow-y-auto">
        {/* Essay selector + title */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activeId ?? ''}
            onChange={(e) =>
              e.target.value === '__new__' ? void newEssay() : void open(e.target.value)
            }
            className="min-w-0 max-w-[12rem] truncate rounded border border-fz-border bg-fz-bg px-2 py-1 text-fz-ui text-fz-fg focus:border-fz-accent focus:outline-none"
            aria-label="Active essay"
          >
            <option value="">{activeId ? title : 'Unsaved essay'}</option>
            {essays.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
            <option value="__new__">+ New essay…</option>
          </select>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void save()}
            placeholder="Essay title"
            aria-label="Essay title"
            className="min-w-0 flex-1"
          />
          {activeId && (
            <Button size="sm" variant="ghost" onClick={() => void remove(activeId)}>
              Delete
            </Button>
          )}
        </div>

        {/* Thesis + controls */}
        <Textarea
          value={thesis}
          autoGrow
          maxRows={4}
          placeholder="Your thesis — e.g. “Orwell uses Winston's diary to dramatize the survival of private thought under totalitarianism.”"
          aria-label="Thesis"
          onChange={(e) => setThesis(e.target.value)}
          onBlur={() => void save()}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl
            options={SCOPE_OPTIONS}
            value={scope}
            onChange={(s) => {
              setScope(s)
            }}
            size="sm"
            aria-label="Source scope"
          />
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="primary"
              loading={generating}
              disabled={!thesis.trim() || (scope === 'active' && !activeDocumentId)}
              onClick={() => void generateOutline()}
            >
              {outline ? 'Regenerate outline' : 'Generate outline'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!outline || draftingId !== null}
              loading={draftingId !== null}
              onClick={() => void draftAll()}
            >
              Draft all
            </Button>
            <Button size="sm" variant="ghost" disabled={!outline} onClick={() => void copyDraft()}>
              Copy draft
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-fz border border-fz-danger/40 bg-fz-danger/10 p-2 text-fz-ui text-fz-danger">
            {error}
          </div>
        )}

        {generating && (
          <div className="space-y-2" aria-busy="true">
            <p className="flex items-center gap-2 text-fz-ui text-fz-fg-muted">
              <span className="fz-spinner inline-block h-3 w-3 rounded-full border-2 border-fz-accent border-t-transparent" />
              Gathering evidence and outlining…
            </p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 rounded-fz border border-fz-border p-3">
                <div className="fz-skeleton h-3 w-1/3 rounded" />
                <div className="fz-skeleton h-3 w-full rounded" />
              </div>
            ))}
          </div>
        )}

        {!generating && !outline && (
          <p className="px-2 py-6 text-center text-fz-ui leading-relaxed text-fz-fg-muted">
            State your thesis and generate an outline. Fuzzy gathers real evidence from your{' '}
            {scope === 'active' ? 'open document' : 'library'}, structures it into body paragraphs
            with citations, then drafts each one on demand.
          </p>
        )}

        {outline?.sections.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            citationFormat={citationFormat}
            drafting={draftingId === section.id}
          />
        ))}
      </div>
    </Modal>
  )
}

function SectionCard({
  section,
  citationFormat,
  drafting
}: {
  section: EssaySection
  citationFormat: CitationFormat
  drafting: boolean
}): React.JSX.Element {
  const draftSection = useEssayStore((s) => s.draftSection)
  const showEvidence = useEssayStore((s) => s.showEvidence)

  return (
    <Card className="space-y-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-fz-label font-semibold uppercase tracking-wider text-fz-accent">
          {section.heading}
        </span>
        <Button size="sm" variant="ghost" loading={drafting} onClick={() => void draftSection(section.id)}>
          {section.draft ? 'Redraft' : 'Draft'}
        </Button>
      </div>

      <p className="text-fz-ui font-medium leading-relaxed text-fz-fg">{section.point}</p>

      {section.evidence.length > 0 && (
        <ul className="space-y-1">
          {section.evidence.map((e, i) => (
            <li key={i} className="rounded border border-fz-border bg-fz-bg/40 p-2">
              <blockquote className="border-l-2 border-fz-accent-2/50 pl-2 text-fz-micro leading-relaxed text-fz-fg-muted">
                “{e.quote}”
              </blockquote>
              <div className="mt-1 flex items-center justify-between gap-2 text-fz-micro text-fz-fg-subtle">
                <span className="truncate">{e.citations[citationFormat]}</span>
                <button
                  type="button"
                  onClick={() => showEvidence(e)}
                  className="shrink-0 text-fz-accent transition hover:text-fz-fg"
                >
                  Go to source →
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {section.draft && (
        <div className="whitespace-pre-wrap rounded-fz border border-fz-border bg-fz-surface p-2 text-fz-ui leading-relaxed text-fz-fg">
          {section.draft}
        </div>
      )}
    </Card>
  )
}
