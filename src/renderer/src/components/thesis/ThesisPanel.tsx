import { useMemo, useState } from 'react'
import { CITATION_FORMAT_LABELS, type CitationFormat, type ThesisScope } from '@shared/types/database'
import { setCitationFormat, useCitationFormat, useThesisStore } from '../../state/thesisStore'
import { useDocumentStore } from '../../state/documentStore'
import { useProjectStore, evidenceKey } from '../../state/projectStore'
import { useSynthesisStore } from '../../state/synthesisStore'
import { Button, SegmentedControl, Textarea } from '../ui'
import { toast } from '../../state/toastStore'
import { ThesisResultCard } from './ThesisResultCard'
import { SynthesisView } from './SynthesisView'
import { CitationDetailsForm } from './CitationDetailsForm'

const SCOPE_OPTIONS: ReadonlyArray<{ value: ThesisScope; label: string }> = [
  { value: 'library', label: 'Whole library' },
  { value: 'active', label: 'This document' }
]

const FORMAT_OPTIONS: ReadonlyArray<{ value: CitationFormat; label: string }> = (
  Object.keys(CITATION_FORMAT_LABELS) as CitationFormat[]
).map((value) => ({ value, label: CITATION_FORMAT_LABELS[value] }))

// The Thesis Workspace: type what you're arguing, get real ranked evidence
// from across your library with one-click citations and jump-to-source. Saved
// quotes land on the active Project's durable evidence shelf.
export function ThesisPanel(): React.JSX.Element {
  const thesis = useThesisStore((s) => s.thesis)
  const scope = useThesisStore((s) => s.scope)
  const status = useThesisStore((s) => s.status)
  const result = useThesisStore((s) => s.result)
  const error = useThesisStore((s) => s.error)
  const setThesis = useThesisStore((s) => s.setThesis)
  const setScope = useThesisStore((s) => s.setScope)
  const runSearch = useThesisStore((s) => s.runSearch)
  const showInPage = useThesisStore((s) => s.showInPage)

  const projects = useProjectStore((s) => s.projects)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const detail = useProjectStore((s) => s.detail)
  const setActiveProject = useProjectStore((s) => s.setActive)
  const createProject = useProjectStore((s) => s.create)
  const addEvidence = useProjectStore((s) => s.addEvidence)
  const removeEvidence = useProjectStore((s) => s.removeEvidence)
  const exportActive = useProjectStore((s) => s.exportActive)

  const synthStatus = useSynthesisStore((s) => s.status)
  const synthMode = useSynthesisStore((s) => s.mode)
  const generateSynthesis = useSynthesisStore((s) => s.generate)

  const citationFormat = useCitationFormat()
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const [editingCitation, setEditingCitation] = useState(false)
  const [shelfOpen, setShelfOpen] = useState(true)

  const analyzing = status === 'analyzing'
  const passages = result?.passages ?? []
  const evidence = detail?.evidence ?? []
  const savedKeys = useMemo(() => new Set(evidence.map((e) => evidenceKey(e))), [evidence])

  const newProject = async (): Promise<void> => {
    await createProject(thesis.trim().slice(0, 60) || 'My Research', thesis)
    toast.success('Project created')
  }

  const copyAll = async (): Promise<void> => {
    const md = await exportActive(citationFormat, 'markdown')
    if (!md) return
    try {
      await navigator.clipboard.writeText(md)
      toast.success('Project copied as Markdown')
    } catch {
      toast.error('Could not copy')
    }
  }

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    void runSearch()
  }

  return (
    <div className="fz-selectable flex min-h-0 flex-1 flex-col">
      <form onSubmit={submit} className="space-y-2 border-b border-fz-border p-3">
        <Textarea
          value={thesis}
          autoGrow
          maxRows={5}
          placeholder="Paste or type your thesis — e.g. “Remote work durably raises knowledge-worker productivity.”"
          aria-label="Thesis statement"
          onChange={(e) => setThesis(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <SegmentedControl
            options={SCOPE_OPTIONS}
            value={scope}
            onChange={setScope}
            size="sm"
            aria-label="Search scope"
          />
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={synthStatus === 'analyzing' && synthMode === 'support'}
              disabled={!thesis.trim()}
              onClick={() => void generateSynthesis('support')}
              title="Build a cited argument FOR your thesis across your library"
            >
              Synthesize
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={synthStatus === 'analyzing' && synthMode === 'counter'}
              disabled={!thesis.trim()}
              onClick={() => void generateSynthesis('counter')}
              title="Surface the strongest case AGAINST your thesis — pre-empt rebuttals"
            >
              Counter
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="primary"
              loading={analyzing}
              disabled={!thesis.trim()}
            >
              Find evidence
            </Button>
          </div>
        </div>
      </form>

      {/* Active project + format */}
      <div className="flex items-center justify-between gap-2 border-b border-fz-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-fz-micro text-fz-fg-subtle">Project</span>
          <select
            value={activeProjectId ?? ''}
            onChange={(e) =>
              e.target.value === '__new__'
                ? void newProject()
                : void setActiveProject(e.target.value || null)
            }
            className="min-w-0 max-w-[10rem] truncate rounded border border-fz-border bg-fz-bg px-1.5 py-1 text-fz-micro text-fz-fg focus:border-fz-accent focus:outline-none"
            aria-label="Active project"
          >
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
            <option value="__new__">+ New project…</option>
          </select>
        </div>
        <SegmentedControl
          options={FORMAT_OPTIONS}
          value={citationFormat}
          onChange={setCitationFormat}
          size="sm"
          aria-label="Citation format"
        />
      </div>

      {/* Durable evidence shelf (active project) */}
      {evidence.length > 0 && (
        <div className="border-b border-fz-border bg-fz-bg/40">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => setShelfOpen((v) => !v)}
              className="text-fz-label font-semibold uppercase tracking-wider text-fz-accent transition hover:text-fz-fg"
            >
              {shelfOpen ? '▾' : '▸'} Evidence · {evidence.length}
            </button>
            <Button size="sm" variant="primary" onClick={() => void copyAll()}>
              Copy all
            </Button>
          </div>
          {shelfOpen && (
            <ul className="max-h-40 space-y-1 overflow-y-auto px-3 pb-2">
              {evidence.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-2 rounded border border-fz-border bg-fz-surface p-2"
                >
                  <span className="line-clamp-2 text-fz-micro text-fz-fg-muted">“{e.snippet}”</span>
                  <button
                    type="button"
                    aria-label="Remove from project"
                    onClick={() => void removeEvidence(e.id)}
                    className="shrink-0 text-fz-fg-subtle transition hover:text-fz-danger"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <SynthesisView citationFormat={citationFormat} />

        {status === 'idle' && synthStatus === 'idle' && (
          <p className="px-2 pt-6 text-center text-fz-ui leading-relaxed text-fz-fg-muted">
            State your argument, then <span className="text-fz-fg">Find evidence</span> for ranked
            quotes or <span className="text-fz-fg">Synthesize</span> a cited argument across your
            library.
          </p>
        )}

        {analyzing && (
          <div className="space-y-3" aria-busy="true">
            <p className="flex items-center gap-2 text-fz-ui text-fz-fg-muted">
              <span className="fz-spinner inline-block h-3 w-3 rounded-full border-2 border-fz-accent border-t-transparent" />
              Analyzing your thesis…
            </p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 rounded-fz border border-fz-border p-3">
                <div className="fz-skeleton h-1 w-full rounded" />
                <div className="fz-skeleton h-3 w-full rounded" />
                <div className="fz-skeleton h-3 w-4/5 rounded" />
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-fz border border-fz-danger/40 bg-fz-danger/10 p-3 text-fz-ui text-fz-danger">
            {error}
          </div>
        )}

        {status === 'done' && passages.length === 0 && (
          <p className="px-2 pt-6 text-center text-fz-ui text-fz-fg-muted">
            No relevant passages found. Try rephrasing your thesis, or import more documents.
          </p>
        )}

        {status === 'done' && passages.length > 0 && (
          <div className="space-y-3">
            {passages.map((p, i) => (
              <ThesisResultCard
                key={p.id}
                passage={p}
                index={i}
                citationFormat={citationFormat}
                saved={savedKeys.has(evidenceKey(p))}
                onShowInPage={showInPage}
                onSave={(passage) => void addEvidence(passage)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Citation details editor for the active document */}
      {activeDocumentId && (
        <div className="border-t border-fz-border p-3">
          <button
            type="button"
            onClick={() => setEditingCitation((v) => !v)}
            className="text-fz-micro font-medium uppercase tracking-wider text-fz-fg-subtle transition hover:text-fz-fg"
          >
            {editingCitation ? '▾ Citation details' : '▸ Edit citation details'}
          </button>
          {editingCitation && (
            <div className="mt-2">
              <CitationDetailsForm
                documentId={activeDocumentId}
                onSaved={() => {
                  if (thesis.trim()) void runSearch()
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
