import type { ClaimAssessment } from '@shared/types/database'
import { useArgumentStore } from '../../state/argumentStore'
import { useCitationFormat } from '../../state/thesisStore'
import { useDocumentStore } from '../../state/documentStore'
import { Button, Card } from '../ui'

const ASSESSMENT_STYLE: Record<ClaimAssessment, { label: string; cls: string }> = {
  'well-supported': { label: 'Supported', cls: 'bg-fz-success/15 text-fz-success' },
  asserted: { label: 'Asserted', cls: 'bg-fz-warning/15 text-fz-warning' },
  contested: { label: 'Contested', cls: 'bg-fz-accent-2/15 text-fz-accent-2' }
}

// Argument Map: extract the active document's own thesis, claims, support, and
// rhetorical moves — the reading-analysis mirror of the Essay Workspace.
export function ArgumentPanel(): React.JSX.Element {
  const status = useArgumentStore((s) => s.status)
  const result = useArgumentStore((s) => s.result)
  const error = useArgumentStore((s) => s.error)
  const run = useArgumentStore((s) => s.run)
  const showEvidence = useArgumentStore((s) => s.showEvidence)

  const citationFormat = useCitationFormat()
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const analyzing = status === 'analyzing'

  return (
    <div className="fz-selectable flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-fz-border p-3">
        <span className="text-fz-ui text-fz-fg-muted">Map this document&apos;s argument</span>
        <Button
          size="sm"
          variant="primary"
          loading={analyzing}
          disabled={!activeDocumentId}
          onClick={() => void run()}
        >
          {result ? 'Re-map' : 'Map argument'}
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {!activeDocumentId && (
          <p className="px-2 pt-6 text-center text-fz-ui leading-relaxed text-fz-fg-muted">
            Open a document to extract its thesis, main claims, supporting evidence, and rhetorical
            moves.
          </p>
        )}

        {activeDocumentId && status === 'idle' && (
          <p className="px-2 pt-6 text-center text-fz-ui leading-relaxed text-fz-fg-muted">
            Map the argument to see the document&apos;s claims, how well each is supported, and the
            rhetoric it uses.
          </p>
        )}

        {analyzing && (
          <div className="space-y-2" aria-busy="true">
            <p className="flex items-center gap-2 text-fz-ui text-fz-fg-muted">
              <span className="fz-spinner inline-block h-3 w-3 rounded-full border-2 border-fz-accent border-t-transparent" />
              Reading the argument…
            </p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 rounded-fz border border-fz-border p-3">
                <div className="fz-skeleton h-3 w-1/2 rounded" />
                <div className="fz-skeleton h-3 w-full rounded" />
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-fz border border-fz-danger/40 bg-fz-danger/10 p-3 text-fz-ui text-fz-danger">
            {error}
          </div>
        )}

        {status === 'done' && result && (
          <div className="space-y-3">
            {result.thesis && (
              <div className="rounded-fz border border-fz-border bg-fz-bg/40 p-3">
                <h3 className="text-fz-label font-semibold uppercase tracking-wider text-fz-fg-subtle">
                  Thesis
                </h3>
                <p className="mt-1 text-fz-ui font-medium leading-relaxed text-fz-fg">
                  {result.thesis}
                </p>
              </div>
            )}

            {result.fallbackReason === 'no_api_key' && (
              <p className="text-fz-micro text-fz-warning">
                Mock mode (no API key) — claims detected locally by assertive phrasing.
              </p>
            )}

            {result.claims.length === 0 && (
              <p className="px-2 text-center text-fz-ui text-fz-fg-muted">
                No clearly stated claims detected.
              </p>
            )}

            {result.claims.map((claim) => {
              const a = ASSESSMENT_STYLE[claim.assessment]
              return (
                <Card key={claim.id} className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-fz-ui font-medium leading-relaxed text-fz-fg">{claim.claim}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-fz-micro font-semibold uppercase tracking-wider ${a.cls}`}
                    >
                      {a.label}
                    </span>
                  </div>
                  {claim.note && <p className="text-fz-micro text-fz-fg-muted">{claim.note}</p>}
                  {claim.support.map((e, i) => (
                    <div key={i} className="rounded border border-fz-border bg-fz-bg/40 p-2">
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
                    </div>
                  ))}
                </Card>
              )
            })}

            {result.rhetoric.length > 0 && (
              <div className="rounded-fz border border-fz-border bg-fz-bg/40 p-3">
                <h3 className="text-fz-label font-semibold uppercase tracking-wider text-fz-fg-subtle">
                  Rhetorical moves
                </h3>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-fz-ui text-fz-fg-muted">
                  {result.rhetoric.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
