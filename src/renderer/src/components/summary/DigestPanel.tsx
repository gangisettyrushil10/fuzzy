import { useState } from 'react'
import { useSummaryStore } from '../../state/summaryStore'
import { useDocumentStore } from '../../state/documentStore'
import { usePdfStore } from '../../state/pdfStore'
import { useTypewriter } from '../../hooks/useTypewriter'
import { Button, Card, Modal, Slider, Tabs, type TabItem } from '../ui'
import { toast } from '../../state/toastStore'

type DigestTab = 'digest' | 'chapters'
const TABS: ReadonlyArray<TabItem<DigestTab>> = [
  { id: 'digest', label: 'Quick digest' },
  { id: 'chapters', label: 'Chapter summaries' }
]

// On-demand condensation: a time-budgeted whole-document digest and per-chapter
// SparkNotes that jump to the source.
export function DigestPanel({
  initialTab = 'digest',
  onClose
}: {
  initialTab?: DigestTab
  onClose: () => void
}): React.JSX.Element {
  const [tab, setTab] = useState<DigestTab>(initialTab)
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)

  return (
    <Modal title="Digest" size="lg" onClose={onClose}>
      <Tabs tabs={TABS} value={tab} onChange={setTab} className="-mt-1 mb-4 border-b border-fz-border" />
      {!activeDocumentId ? (
        <p className="text-fz-ui text-fz-fg-muted">Open a document first.</p>
      ) : tab === 'digest' ? (
        <DigestTabView documentId={activeDocumentId} />
      ) : (
        <ChaptersTabView documentId={activeDocumentId} onClose={onClose} />
      )}
    </Modal>
  )
}

function DigestTabView({ documentId }: { documentId: string }): React.JSX.Element {
  const minutes = useSummaryStore((s) => s.digestMinutes)
  const setMinutes = useSummaryStore((s) => s.setDigestMinutes)
  const status = useSummaryStore((s) => s.digestStatus)
  const digest = useSummaryStore((s) => s.digest)
  const error = useSummaryStore((s) => s.digestError)
  const runDigest = useSummaryStore((s) => s.runDigest)

  const { display } = useTypewriter({
    id: digest ? `digest:${digest.documentId}:${digest.targetMinutes}` : 'digest:none',
    text: digest?.text ?? '',
    enabled: status === 'done'
  })

  const copy = async (): Promise<void> => {
    if (!digest) return
    try {
      await navigator.clipboard.writeText(digest.text)
      toast.success('Digest copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <span className="text-fz-ui text-fz-fg-muted">
          Read it in <span className="font-semibold text-fz-accent">{minutes} min</span>
        </span>
        <Slider aria-label="Digest length (minutes)" value={minutes} min={2} max={30} step={1} onChange={setMinutes} />
      </div>
      <Button variant="primary" loading={status === 'loading'} onClick={() => void runDigest(documentId)}>
        {digest ? 'Regenerate digest' : 'Generate digest'}
      </Button>

      {status === 'error' && (
        <p className="rounded-fz border border-fz-danger/40 bg-fz-danger/10 p-3 text-fz-ui text-fz-danger">
          {error}
        </p>
      )}
      {status === 'loading' && (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="fz-skeleton h-3 w-full rounded" />
          ))}
        </div>
      )}
      {status === 'done' && digest && (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap text-fz-body leading-relaxed text-fz-fg">{display}</p>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => void copy()}>
              Copy
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ChaptersTabView({
  documentId,
  onClose
}: {
  documentId: string
  onClose: () => void
}): React.JSX.Element {
  const status = useSummaryStore((s) => s.chaptersStatus)
  const chapters = useSummaryStore((s) => s.chapters)
  const error = useSummaryStore((s) => s.chaptersError)
  const runChapters = useSummaryStore((s) => s.runChapters)
  const setPage = usePdfStore((s) => s.setPage)

  const jump = (pageNumber: number): void => {
    setPage(pageNumber)
    onClose()
  }

  return (
    <div className="space-y-4">
      <Button variant="primary" loading={status === 'loading'} onClick={() => void runChapters(documentId)}>
        {chapters ? 'Regenerate summaries' : 'Generate chapter summaries'}
      </Button>

      {status === 'error' && (
        <p className="rounded-fz border border-fz-danger/40 bg-fz-danger/10 p-3 text-fz-ui text-fz-danger">
          {error}
        </p>
      )}
      {status === 'loading' && (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5 rounded-fz border border-fz-border p-3">
              <div className="fz-skeleton h-3 w-1/3 rounded" />
              <div className="fz-skeleton h-3 w-full rounded" />
            </div>
          ))}
        </div>
      )}
      {status === 'done' && chapters && (
        <div className="space-y-2">
          {chapters.chapters.length === 0 ? (
            <p className="text-fz-ui text-fz-fg-muted">No extractable chapters yet.</p>
          ) : (
            chapters.chapters.map((c) => (
              <Card key={c.index} className="space-y-1 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-fz-ui font-medium text-fz-fg" title={c.title}>
                    {c.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => jump(c.pageNumber)}
                    className="shrink-0 text-fz-micro text-fz-accent transition hover:text-fz-fg"
                  >
                    Go to →
                  </button>
                </div>
                <p className="text-fz-ui leading-relaxed text-fz-fg-muted">{c.summary}</p>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
