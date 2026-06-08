import { useMemo } from 'react'
import { useGlossaryStore } from '../../state/glossaryStore'
import { useDocumentStore } from '../../state/documentStore'
import { Button, Card, Input } from '../ui'

// Key Terms Glossary: the document's defined terms with plain definitions and a
// cited, jump-able source quote. Filterable; built on demand ($0 with no key).
export function GlossaryPanel(): React.JSX.Element {
  const status = useGlossaryStore((s) => s.status)
  const result = useGlossaryStore((s) => s.result)
  const error = useGlossaryStore((s) => s.error)
  const filter = useGlossaryStore((s) => s.filter)
  const setFilter = useGlossaryStore((s) => s.setFilter)
  const build = useGlossaryStore((s) => s.build)
  const showTerm = useGlossaryStore((s) => s.showTerm)

  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const analyzing = status === 'analyzing'

  const terms = useMemo(() => {
    const all = result?.terms ?? []
    const q = filter.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (t) => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)
    )
  }, [result, filter])

  return (
    <div className="fz-selectable flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-fz-border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-fz-ui text-fz-fg-muted">Key terms in this document</span>
          <Button
            size="sm"
            variant="primary"
            loading={analyzing}
            disabled={!activeDocumentId}
            onClick={() => void build()}
          >
            {result ? 'Rebuild' : 'Build glossary'}
          </Button>
        </div>
        {result && result.terms.length > 0 && (
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter terms…"
            aria-label="Filter glossary"
          />
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {!activeDocumentId && (
          <p className="px-2 pt-6 text-center text-fz-ui leading-relaxed text-fz-fg-muted">
            Open a document to extract the key terms you need to understand it — each with a plain
            definition and a jump-to-source.
          </p>
        )}

        {activeDocumentId && status === 'idle' && (
          <p className="px-2 pt-6 text-center text-fz-ui leading-relaxed text-fz-fg-muted">
            Build a glossary to get this document&apos;s defined terms, in plain English, with
            citations.
          </p>
        )}

        {analyzing && (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-1 rounded-fz border border-fz-border p-3">
                <div className="fz-skeleton h-3 w-1/4 rounded" />
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
          <>
            {result.fallbackReason === 'no_api_key' && (
              <p className="text-fz-micro text-fz-warning">
                Mock mode (no API key) — terms detected locally by definition patterns.
              </p>
            )}
            {result.terms.length === 0 && (
              <p className="px-2 pt-4 text-center text-fz-ui text-fz-fg-muted">
                No defined terms detected in this document.
              </p>
            )}
            {result.terms.length > 0 && terms.length === 0 && (
              <p className="px-2 pt-4 text-center text-fz-ui text-fz-fg-muted">No terms match “{filter}”.</p>
            )}
            {terms.map((t, i) => (
              <Card key={`${t.term}-${i}`} className="space-y-1 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-fz-ui font-semibold text-fz-fg">{t.term}</h3>
                  <button
                    type="button"
                    onClick={() => showTerm(t)}
                    className="shrink-0 text-fz-micro text-fz-accent transition hover:text-fz-fg"
                  >
                    p. {t.pageNumber} →
                  </button>
                </div>
                <p className="text-fz-ui leading-relaxed text-fz-fg-muted">{t.definition}</p>
                <blockquote className="border-l-2 border-fz-accent-2/40 pl-2 text-fz-micro italic leading-relaxed text-fz-fg-subtle">
                  “{t.sourceQuote}”
                </blockquote>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
