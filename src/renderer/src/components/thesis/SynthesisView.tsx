import type { CitationFormat, SynthesisResult } from '@shared/types/database'
import { useSynthesisStore } from '../../state/synthesisStore'
import { useThesisStore } from '../../state/thesisStore'
import { useProjectStore } from '../../state/projectStore'
import { Button, Panel } from '../ui'
import { toast } from '../../state/toastStore'

// Renders a generated cross-document argument: sub-claims with cited quotes
// (each jumps to source), tensions, and a summary. Save it to the active project.
export function SynthesisView({ citationFormat }: { citationFormat: CitationFormat }): React.JSX.Element | null {
  const status = useSynthesisStore((s) => s.status)
  const mode = useSynthesisStore((s) => s.mode)
  const result = useSynthesisStore((s) => s.result)
  const error = useSynthesisStore((s) => s.error)
  const showInPage = useThesisStore((s) => s.showInPage)
  const addSynthesis = useProjectStore((s) => s.addSynthesis)
  const counter = mode === 'counter'

  if (status === 'idle') return null

  if (status === 'analyzing') {
    return (
      <Panel className="space-y-2 p-3">
        <p className="flex items-center gap-2 text-fz-ui text-fz-fg-muted">
          <span className="fz-spinner inline-block h-3 w-3 rounded-full border-2 border-fz-accent border-t-transparent" />
          {counter ? 'Finding the counter-case…' : 'Building your argument…'}
        </p>
        <div className="fz-skeleton h-3 w-3/4 rounded" />
        <div className="fz-skeleton h-3 w-full rounded" />
        <div className="fz-skeleton h-3 w-5/6 rounded" />
      </Panel>
    )
  }

  if (status === 'error') {
    return (
      <Panel className="p-3 text-fz-ui text-fz-danger">{error ?? 'Synthesis failed.'}</Panel>
    )
  }

  if (!result) return null

  const save = async (): Promise<void> => {
    await addSynthesis(result.thesis, result)
    toast.success('Synthesis saved to project')
  }

  return (
    <Panel tone="raised" className="space-y-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-fz-label font-semibold uppercase tracking-wider ${counter ? 'text-fz-warning' : 'text-fz-accent'}`}
        >
          {counter ? 'Counter-arguments' : 'Synthesized argument'}
        </span>
        <Button size="sm" variant="primary" onClick={() => void save()}>
          Save to project
        </Button>
      </div>

      {result.subClaims.map((sub, i) => (
        <div key={i} className="space-y-1.5">
          <p className="text-fz-body font-medium text-fz-fg">{sub.claim}</p>
          <ul className="space-y-1.5">
            {sub.evidence.map((ev, j) => (
              <li key={j} className="rounded border border-fz-border bg-fz-bg/50 p-2">
                <blockquote className="border-l-2 border-fz-accent-2/50 pl-2 text-fz-ui leading-relaxed text-fz-fg">
                  “{ev.quote}”
                </blockquote>
                <div className="mt-1 flex items-center justify-between gap-2 text-fz-micro text-fz-fg-subtle">
                  <span className="truncate">{ev.citations[citationFormat]}</span>
                  <button
                    type="button"
                    onClick={() =>
                      showInPage({
                        id: `${ev.documentId}:${ev.pageNumber}:0`,
                        documentId: ev.documentId,
                        documentTitle: ev.documentTitle,
                        pageNumber: ev.pageNumber,
                        snippet: ev.quote,
                        score: 1,
                        citations: ev.citations
                      })
                    }
                    className="shrink-0 text-fz-accent transition hover:text-fz-fg"
                  >
                    Go to source →
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {result.tensions.length > 0 && (
        <div>
          <span className="text-fz-label font-semibold uppercase tracking-wider text-fz-warning">
            Tensions
          </span>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-fz-ui text-fz-fg-muted">
            {result.tensions.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {result.summary && (
        <p className="border-t border-fz-border pt-2 text-fz-ui leading-relaxed text-fz-fg-muted">
          {result.summary}
        </p>
      )}
    </Panel>
  )
}

// Re-export for convenience.
export type { SynthesisResult }
