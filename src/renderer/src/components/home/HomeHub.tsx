import { useEffect, useState } from 'react'
import { useDocumentStore } from '../../state/documentStore'
import { useProjectStore } from '../../state/projectStore'
import { useFocusSessionStore } from '../../state/focusSessionStore'
import { useFlashcardReviewStore } from '../../state/flashcardReviewStore'
import { useAppUiStore } from '../../state/appUiStore'
import { useOnboardingStore } from '../../state/onboardingStore'
import { Button, Card, Panel } from '../ui'
import { toast } from '../../state/toastStore'
import { FILE_FORMATS } from '@shared/formats'
import { ReviewQueueModal } from '../study/ReviewQueueModal'

// The Library home: recent documents, research projects, reading stats, and
// quick actions. Shown when no document is open — makes Fuzzy feel like a
// workspace you return to, not just a viewer.
export function HomeHub(): React.JSX.Element {
  const documents = useDocumentStore((s) => s.documents)
  const setActiveDocument = useDocumentStore((s) => s.setActiveDocument)
  const importDocument = useDocumentStore((s) => s.importDocument)
  const importSample = useDocumentStore((s) => s.importSampleDocument)

  const projects = useProjectStore((s) => s.projects)
  const setActiveProject = useProjectStore((s) => s.setActive)
  const createProject = useProjectStore((s) => s.create)

  const stats = useFocusSessionStore((s) => s.stats)
  const loadStats = useFocusSessionStore((s) => s.loadStats)
  const dueCount = useFlashcardReviewStore((s) => s.dueCount)
  const loadDueCount = useFlashcardReviewStore((s) => s.loadDueCount)
  const setStatsOpen = useAppUiStore((s) => s.setStatsOpen)
  const showOnboarding = useOnboardingStore((s) => s.show)

  const [busy, setBusy] = useState<'import' | 'sample' | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)

  useEffect(() => {
    void loadStats()
    void loadDueCount()
  }, [loadStats, loadDueCount])

  const onImport = async (): Promise<void> => {
    setBusy('import')
    try {
      const doc = await importDocument()
      if (doc) showOnboarding()
    } finally {
      setBusy(null)
    }
  }

  const onSample = async (): Promise<void> => {
    setBusy('sample')
    try {
      const doc = await importSample()
      if (doc) showOnboarding()
    } finally {
      setBusy(null)
    }
  }

  const onNewProject = async (): Promise<void> => {
    await createProject('My Research')
    toast.success('Project created — collect evidence from the Thesis tab')
  }

  return (
    <div className="flex flex-1 justify-center overflow-y-auto bg-fz-bg p-8">
      <div className="w-full max-w-3xl space-y-8 py-6">
        {/* Header + quick actions */}
        <header>
          <div className="mb-4 flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-fz-accent-2/15 text-xl font-bold text-fz-accent">
              F
            </div>
            <div>
              <h1 className="text-fz-title font-semibold text-fz-fg">Welcome back</h1>
              <p className="text-fz-ui text-fz-fg-muted">Pick up where you left off, or start something new.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" loading={busy === 'import'} onClick={() => void onImport()}>
              Import document
            </Button>
            <Button variant="secondary" loading={busy === 'sample'} onClick={() => void onSample()}>
              Try sample
            </Button>
            <Button variant="secondary" onClick={() => void onNewProject()}>
              New project
            </Button>
            <Button variant="ghost" onClick={() => setStatsOpen(true)}>
              Insights
            </Button>
          </div>
        </header>

        {/* Stats strip */}
        {stats && stats.sessionCount > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Today" value={`${stats.todayMinutes}m`} />
            <StatCard label="Streak" value={`${stats.streakDays}d`} accent />
            <StatCard label="Avg speed" value={`${stats.avgWpm} wpm`} />
          </div>
        )}

        {/* Spaced-repetition review queue */}
        {dueCount > 0 && (
          <Card
            interactive
            className="flex items-center justify-between gap-3 border-fz-accent-2/40 bg-fz-accent-2/5 p-4"
            onClick={() => setReviewOpen(true)}
          >
            <div>
              <div className="text-fz-ui font-semibold text-fz-fg">
                {dueCount} flashcard{dueCount === 1 ? '' : 's'} due for review
              </div>
              <div className="text-fz-micro text-fz-fg-subtle">
                Spaced repetition across all your study packs.
              </div>
            </div>
            <span className="rounded-md border border-fz-accent-2/60 bg-fz-accent-2/15 px-3 py-1.5 text-fz-ui text-fz-fg">
              Review now
            </span>
          </Card>
        )}

        {/* Recent documents */}
        <section>
          <h2 className="mb-2 text-fz-label font-semibold uppercase tracking-wider text-fz-fg-subtle">
            Recent documents
          </h2>
          {documents.length === 0 ? (
            <Panel className="p-5 text-center text-fz-ui text-fz-fg-muted">
              No documents yet. Import a PDF, EPUB, or text file to start reading.
            </Panel>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {documents.slice(0, 8).map((doc) => (
                <Card
                  key={doc.id}
                  interactive
                  className="flex items-center gap-3 p-3"
                  onClick={() => setActiveDocument(doc.id)}
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-fz-bg text-fz-micro uppercase text-fz-fg-subtle">
                    {FILE_FORMATS[doc.fileType]?.label?.slice(0, 3) ?? 'DOC'}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-fz-ui text-fz-fg" title={doc.title}>
                      {doc.title}
                    </span>
                    {doc.pageCount != null && (
                      <span className="text-fz-micro text-fz-fg-subtle">{doc.pageCount} pages</span>
                    )}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Projects */}
        {projects.length > 0 && (
          <section>
            <h2 className="mb-2 text-fz-label font-semibold uppercase tracking-wider text-fz-fg-subtle">
              Projects
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {projects.slice(0, 6).map((p) => (
                <Card
                  key={p.id}
                  interactive
                  className="p-3"
                  onClick={() => {
                    void setActiveProject(p.id)
                    toast.success(`“${p.title}” is now your active project`)
                  }}
                >
                  <span className="block truncate text-fz-ui text-fz-fg" title={p.title}>
                    {p.title}
                  </span>
                  {p.thesis && (
                    <span className="line-clamp-1 text-fz-micro text-fz-fg-subtle">{p.thesis}</span>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        <p className="text-fz-micro text-fz-fg-subtle">
          Your files stay on this Mac. AI runs only when you request it.
        </p>
      </div>

      {reviewOpen && (
        <ReviewQueueModal
          onClose={() => {
            setReviewOpen(false)
            void loadDueCount()
          }}
        />
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  accent
}: {
  label: string
  value: string
  accent?: boolean
}): React.JSX.Element {
  return (
    <Panel className="p-3">
      <div className={`text-fz-title font-semibold ${accent ? 'text-fz-accent' : 'text-fz-fg'}`}>
        {value}
      </div>
      <div className="text-fz-micro uppercase tracking-wider text-fz-fg-subtle">{label}</div>
    </Panel>
  )
}
