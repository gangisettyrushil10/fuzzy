import { useToneStore } from '../../state/toneStore'
import { useDocumentStore } from '../../state/documentStore'
import { Button, Card, Input } from '../ui'

// Suggested tones for one-tap searches.
const SUGGESTED = ['melancholic', 'tense', 'hopeful', 'joyful', 'somber', 'nostalgic', 'romantic']

// "Ctrl-F for tone": type or tap a mood; get the document's most tone-bearing
// passages ranked locally, each with the diction that creates the tone, and
// jump straight to them. Zero API cost.
export function TonePanel(): React.JSX.Element {
  const tone = useToneStore((s) => s.tone)
  const status = useToneStore((s) => s.status)
  const result = useToneStore((s) => s.result)
  const error = useToneStore((s) => s.error)
  const setTone = useToneStore((s) => s.setTone)
  const runSearch = useToneStore((s) => s.runSearch)
  const showInPage = useToneStore((s) => s.showInPage)

  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const analyzing = status === 'analyzing'
  const passages = result?.passages ?? []

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    void runSearch()
  }

  return (
    <div className="fz-selectable flex min-h-0 flex-1 flex-col">
      <form onSubmit={submit} className="space-y-2 border-b border-fz-border p-3">
        <div className="flex gap-2">
          <Input
            value={tone}
            placeholder="A tone — e.g. melancholic, tense, hopeful…"
            aria-label="Tone"
            onChange={(e) => setTone(e.target.value)}
            className="min-w-0 flex-1"
          />
          <Button
            type="submit"
            size="sm"
            variant="primary"
            loading={analyzing}
            disabled={!tone.trim() || !activeDocumentId}
          >
            Find
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {SUGGESTED.map((t) => (
            <button
              key={t}
              type="button"
              disabled={!activeDocumentId}
              onClick={() => void runSearch(t)}
              className="rounded-full border border-fz-border px-2 py-0.5 text-fz-micro text-fz-fg-muted transition hover:bg-fz-bg hover:text-fz-fg disabled:opacity-40"
            >
              {t}
            </button>
          ))}
        </div>
      </form>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {!activeDocumentId && (
          <p className="px-2 pt-6 text-center text-fz-ui leading-relaxed text-fz-fg-muted">
            Open a document, then search it for a mood — Fuzzy ranks the passages whose word choice
            most evokes that tone.
          </p>
        )}

        {activeDocumentId && status === 'idle' && (
          <p className="px-2 pt-6 text-center text-fz-ui leading-relaxed text-fz-fg-muted">
            Search for a tone to find — and jump to — the passages that create it.
          </p>
        )}

        {analyzing && (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 rounded-fz border border-fz-border p-3">
                <div className="fz-skeleton h-1 w-1/4 rounded" />
                <div className="fz-skeleton h-3 w-full rounded" />
                <div className="fz-skeleton h-3 w-3/4 rounded" />
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
            No clearly {result?.tone} passages found. Try a different tone.
          </p>
        )}

        {status === 'done' &&
          passages.map((m, i) => (
            <Card
              key={m.id}
              className="fz-palette-enter space-y-2 p-3"
              style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {m.matchedWords.slice(0, 5).map((w) => (
                    <span
                      key={w}
                      className="rounded bg-fz-accent-2/15 px-1.5 py-0.5 text-fz-micro text-fz-accent-2"
                    >
                      {w}
                    </span>
                  ))}
                </div>
                <span className="shrink-0 text-fz-micro tabular-nums text-fz-fg-subtle">
                  p. {m.pageNumber}
                </span>
              </div>
              <blockquote className="border-l-2 border-fz-accent-2/50 pl-2 text-fz-ui leading-relaxed text-fz-fg">
                “{m.snippet}”
              </blockquote>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => showInPage(m)}
                  className="text-fz-micro text-fz-accent transition hover:text-fz-fg"
                >
                  Go to source →
                </button>
              </div>
            </Card>
          ))}
      </div>
    </div>
  )
}
