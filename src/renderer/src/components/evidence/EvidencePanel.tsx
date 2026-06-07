import { CITATION_FORMAT_LABELS, type CitationFormat } from '@shared/types/database'
import { useEvidenceStore } from '../../state/evidenceStore'
import { setCitationFormat, useCitationFormat } from '../../state/thesisStore'
import { useDocumentStore } from '../../state/documentStore'
import { Button, SegmentedControl, Textarea } from '../ui'
import { EvidenceResultCard } from './EvidenceResultCard'
import { CastSection } from './CastSection'

const FORMAT_OPTIONS: ReadonlyArray<{ value: CitationFormat; label: string }> = (
  Object.keys(CITATION_FORMAT_LABELS) as CitationFormat[]
).map((value) => ({ value, label: CITATION_FORMAT_LABELS[value] }))

// Evidence search: ask an inferential question about the active document ("find
// evidence that Elizabeth and Darcy are in love") and get verified, cited,
// jump-to-source passages grouped into sub-claims.
export function EvidencePanel(): React.JSX.Element {
  const query = useEvidenceStore((s) => s.query)
  const status = useEvidenceStore((s) => s.status)
  const result = useEvidenceStore((s) => s.result)
  const error = useEvidenceStore((s) => s.error)
  const setQuery = useEvidenceStore((s) => s.setQuery)
  const runSearch = useEvidenceStore((s) => s.runSearch)
  const showInPage = useEvidenceStore((s) => s.showInPage)

  const citationFormat = useCitationFormat()
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const analyzing = status === 'analyzing'

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    void runSearch()
  }

  return (
    <div className="fz-selectable flex min-h-0 flex-1 flex-col">
      <form onSubmit={submit} className="space-y-2 border-b border-fz-border p-3">
        <Textarea
          value={query}
          autoGrow
          maxRows={4}
          placeholder="Ask the document — e.g. “Find evidence that Elizabeth and Darcy are in love.”"
          aria-label="Evidence query"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <SegmentedControl
            options={FORMAT_OPTIONS}
            value={citationFormat}
            onChange={setCitationFormat}
            size="sm"
            aria-label="Citation format"
          />
          <Button
            type="submit"
            size="sm"
            variant="primary"
            loading={analyzing}
            disabled={!query.trim() || !activeDocumentId}
          >
            Find evidence
          </Button>
        </div>
      </form>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <CastSection />

        {!activeDocumentId && (
          <p className="px-2 pt-6 text-center text-fz-ui leading-relaxed text-fz-fg-muted">
            Open a document, then ask for evidence of a claim about it — a relationship, a theme, a
            tone — and jump straight to the cited passages.
          </p>
        )}

        {activeDocumentId && status === 'idle' && (
          <p className="px-2 pt-6 text-center text-fz-ui leading-relaxed text-fz-fg-muted">
            Ask an inferential question about this document and Fuzzy will gather, verify, and cite
            the supporting passages.
          </p>
        )}

        {analyzing && (
          <div className="space-y-3" aria-busy="true">
            <p className="flex items-center gap-2 text-fz-ui text-fz-fg-muted">
              <span className="fz-spinner inline-block h-3 w-3 rounded-full border-2 border-fz-accent border-t-transparent" />
              Gathering and weighing evidence…
            </p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 rounded-fz border border-fz-border p-3">
                <div className="fz-skeleton h-1 w-1/3 rounded" />
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

        {status === 'done' && result && (
          <div className="space-y-4">
            <div className="rounded-fz border border-fz-border bg-fz-bg/40 p-3">
              <p className="text-fz-ui font-medium leading-relaxed text-fz-fg">{result.claim}</p>
              {result.summary && (
                <p className="mt-1 text-fz-micro text-fz-fg-muted">{result.summary}</p>
              )}
              {result.fallbackReason === 'no_api_key' && (
                <p className="mt-1.5 text-fz-micro text-fz-warning">
                  Running in mock mode (no API key) — evidence is matched locally.
                </p>
              )}
            </div>

            {result.subClaims.length === 0 && (
              <p className="px-2 text-center text-fz-ui text-fz-fg-muted">
                No clear evidence found. Try naming the characters explicitly or rephrasing the
                claim.
              </p>
            )}

            {result.subClaims.map((sub, si) => (
              <div key={si} className="space-y-2">
                <h3 className="text-fz-label font-semibold uppercase tracking-wider text-fz-accent">
                  {sub.claim}
                </h3>
                {sub.evidence.map((item, i) => (
                  <EvidenceResultCard
                    key={item.id}
                    item={item}
                    index={i}
                    citationFormat={citationFormat}
                    onShowInPage={showInPage}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
