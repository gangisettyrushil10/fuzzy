import { useAskStore } from '../../state/askStore'
import { useDocumentStore } from '../../state/documentStore'
import { Button, Card, Textarea } from '../ui'

// "Ask the book": ask a question about the active document and get a concise,
// citation-anchored answer plus the source passages (jump-able). The spoiler-safe
// toggle restricts retrieval to what you've already read.
export function AskPanel(): React.JSX.Element {
  const question = useAskStore((s) => s.question)
  const spoilerSafe = useAskStore((s) => s.spoilerSafe)
  const webSearch = useAskStore((s) => s.webSearch)
  const status = useAskStore((s) => s.status)
  const result = useAskStore((s) => s.result)
  const error = useAskStore((s) => s.error)
  const setQuestion = useAskStore((s) => s.setQuestion)
  const setSpoilerSafe = useAskStore((s) => s.setSpoilerSafe)
  const setWebSearch = useAskStore((s) => s.setWebSearch)
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <label className="flex items-center gap-1.5 text-fz-micro text-fz-fg-muted">
              <input
                type="checkbox"
                checked={spoilerSafe}
                onChange={(e) => setSpoilerSafe(e.target.checked)}
                className="accent-fz-accent"
              />
              Spoiler-safe (only what I&apos;ve read)
            </label>
            <label className="flex items-center gap-1.5 text-fz-micro text-fz-fg-muted">
              <input
                type="checkbox"
                checked={webSearch}
                onChange={(e) => setWebSearch(e.target.checked)}
                className="accent-fz-accent"
              />
              Search the web
            </label>
          </div>
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
            to keep answers to the pages you&apos;ve already read, or{' '}
            <span className="text-fz-fg">search the web</span> to pull in outside, up-to-date info.
          </p>
        )}

        {asking && (
          <div className="space-y-2" aria-busy="true">
            <p className="flex items-center gap-2 text-fz-ui text-fz-fg-muted">
              <span className="fz-spinner inline-block h-3 w-3 rounded-full border-2 border-fz-accent border-t-transparent" />
              {webSearch ? 'Reading the document & searching the web…' : 'Reading the document…'}
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
            {result.mode === 'summary' && (
              <p className="flex items-center gap-1.5 text-fz-micro text-fz-fg-subtle">
                <span aria-hidden>📖</span> Summary of{' '}
                {result.summaryPage != null ? `chapter ${result.summaryPage}` : 'the current chapter'}.
              </p>
            )}
            <div className="whitespace-pre-wrap rounded-fz border border-fz-border bg-fz-bg/40 p-3 text-fz-ui leading-relaxed text-fz-fg">
              {result.answer}
            </div>
            {result.usedWeb && (
              <p className="flex items-center gap-1.5 text-fz-micro text-fz-accent">
                <span aria-hidden>🌐</span> Answered with a live web search.
              </p>
            )}
            {result.webError && (
              <p className="rounded-fz border border-fz-warning/40 bg-fz-warning/10 p-2 text-fz-micro text-fz-warning">
                Web search couldn&apos;t run ({result.webError}) — answered from the document instead.
              </p>
            )}
            {result.spoilerSafe && (
              <p className="text-fz-micro text-fz-fg-subtle">
                Answered using only pages you&apos;ve read.
              </p>
            )}
            {result.webSources && result.webSources.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-fz-label font-semibold uppercase tracking-wider text-fz-fg-subtle">
                  From the web
                </h3>
                {result.webSources.map((w) => (
                  <a
                    key={w.url}
                    href={w.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate rounded-fz border border-fz-border bg-fz-bg/40 px-2 py-1.5 text-fz-micro text-fz-accent transition hover:border-fz-accent/50 hover:text-fz-fg"
                    title={w.url}
                  >
                    {w.title}
                  </a>
                ))}
              </div>
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
