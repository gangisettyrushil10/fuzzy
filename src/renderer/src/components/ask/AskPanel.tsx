import { useAskStore } from '../../state/askStore'
import { useDocumentStore } from '../../state/documentStore'
import { Button, Card, Textarea } from '../ui'

// "Ask the book": ask a question about the active document and get a concise,
// citation-anchored answer plus the source passages (jump-able). The spoiler-safe
// toggle restricts retrieval to what you've already read.
export function AskPanel(): React.JSX.Element {
  const question = useAskStore((s) => s.question)
  const spoilerSafe = useAskStore((s) => s.spoilerSafe)
  const status = useAskStore((s) => s.status)
  const result = useAskStore((s) => s.result)
  const error = useAskStore((s) => s.error)
  const setQuestion = useAskStore((s) => s.setQuestion)
  const setSpoilerSafe = useAskStore((s) => s.setSpoilerSafe)
  const ask = useAskStore((s) => s.ask)
  const showInPage = useAskStore((s) => s.showInPage)

  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const asking = status === 'asking'

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    void ask()
  }

  return (
    <div className="fz-selectable flex min-h-0 flex-1 flex-col">
      <form onSubmit={submit} className="space-y-2 border-b border-fz-border p-3">
        <Textarea
          value={question}
          autoGrow
          maxRows={4}
          placeholder="Ask about this document — e.g. “What is the narrator afraid of?”"
          aria-label="Question"
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-fz-micro text-fz-fg-muted">
            <input
              type="checkbox"
              checked={spoilerSafe}
              onChange={(e) => setSpoilerSafe(e.target.checked)}
              className="accent-fz-accent"
            />
            Spoiler-safe (only what I&apos;ve read)
          </label>
          <Button
            type="submit"
            size="sm"
            variant="primary"
            loading={asking}
            disabled={!question.trim() || !activeDocumentId}
          >
            Ask
          </Button>
        </div>
      </form>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {!activeDocumentId && (
          <p className="px-2 pt-6 text-center text-fz-ui leading-relaxed text-fz-fg-muted">
            Open a document to ask questions about it — answers are grounded in the text and cite
            their sources.
          </p>
        )}

        {activeDocumentId && status === 'idle' && (
          <p className="px-2 pt-6 text-center text-fz-ui leading-relaxed text-fz-fg-muted">
            Ask anything about this document. Turn on <span className="text-fz-fg">spoiler-safe</span>{' '}
            to keep answers to the pages you&apos;ve already read.
          </p>
        )}

        {asking && (
          <div className="space-y-2" aria-busy="true">
            <p className="flex items-center gap-2 text-fz-ui text-fz-fg-muted">
              <span className="fz-spinner inline-block h-3 w-3 rounded-full border-2 border-fz-accent border-t-transparent" />
              Reading the document…
            </p>
            <div className="fz-skeleton h-3 w-full rounded" />
            <div className="fz-skeleton h-3 w-5/6 rounded" />
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-fz border border-fz-danger/40 bg-fz-danger/10 p-3 text-fz-ui text-fz-danger">
            {error}
          </div>
        )}

        {status === 'done' && result && (
          <div className="space-y-3">
            <div className="whitespace-pre-wrap rounded-fz border border-fz-border bg-fz-bg/40 p-3 text-fz-ui leading-relaxed text-fz-fg">
              {result.answer}
            </div>
            {result.spoilerSafe && (
              <p className="text-fz-micro text-fz-fg-subtle">
                Answered using only pages you&apos;ve read.
              </p>
            )}
            {result.fallbackReason === 'no_api_key' && (
              <p className="text-fz-micro text-fz-warning">
                Mock mode (no API key) — showing the most relevant passages instead of a written
                answer.
              </p>
            )}
            {result.sources.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-fz-label font-semibold uppercase tracking-wider text-fz-fg-subtle">
                  Sources
                </h3>
                {result.sources.map((s) => (
                  <Card key={s.id} className="space-y-1 p-2">
                    <blockquote className="border-l-2 border-fz-accent-2/50 pl-2 text-fz-micro leading-relaxed text-fz-fg-muted">
                      “{s.snippet}”
                    </blockquote>
                    <div className="flex items-center justify-between text-fz-micro text-fz-fg-subtle">
                      <span>p. {s.pageNumber}</span>
                      <button
                        type="button"
                        onClick={() => showInPage(s)}
                        className="text-fz-accent transition hover:text-fz-fg"
                      >
                        Go to source →
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
