import { useEffect, useMemo, useState } from 'react'
import { usePdfStore } from '../../state/pdfStore'
import { useAnnotationStore } from '../../state/annotationStore'
import { useReadingSessionStore } from '../../state/readingSessionStore'
import { useDocumentStore } from '../../state/documentStore'
import { useAppUiStore } from '../../state/appUiStore'
import { ReadingPlanModal } from '../reading/ReadingPlanModal'

export function BottomReadingBar(): React.JSX.Element {
  const pageCount = usePdfStore((s) => s.pageCount)
  const currentPage = usePdfStore((s) => s.currentPage)
  const pageTexts = usePdfStore((s) => s.pageTexts)
  const annotations = useAnnotationStore((s) => s.annotations)
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const session = useReadingSessionStore((s) => s.session)
  const startedAt = useReadingSessionStore((s) => s.startedAt)
  const startSession = useReadingSessionStore((s) => s.startSession)

  const planModalOpen = useAppUiStore((s) => s.planModalOpen)
  const setPlanModalOpen = useAppUiStore((s) => s.setPlanModalOpen)
  const [now, setNow] = useState(() => Date.now())

  // Tick once per second while a session has been started. Cheap — single
  // setInterval that runs only when there's something to display.
  useEffect(() => {
    if (!session || !startedAt) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [session, startedAt])

  const pageLabel = pageCount > 0 ? `Page ${currentPage} / ${pageCount}` : 'No document open'
  const extractedLabel = pageCount > 0 ? `${pageTexts.size} / ${pageCount} pages indexed` : ''

  // Which plan section covers the current page?
  const currentSection = useMemo(() => {
    if (!session) return null
    return (
      session.plan.sections.find((s) => currentPage >= s.pageStart && currentPage <= s.pageEnd) ??
      null
    )
  }, [session, currentPage])

  const elapsedMinutes = startedAt ? Math.max(0, (now - startedAt) / 60_000) : 0

  return (
    <>
      <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-fz-border bg-fz-surface-2 px-3 text-[11px] text-fz-fg-muted">
        <span>{pageLabel}</span>
        {extractedLabel && (
          <>
            <span className="text-fz-fg-subtle">·</span>
            <span className="text-fz-fg-subtle">{extractedLabel}</span>
          </>
        )}
        {annotations.length > 0 && (
          <>
            <span className="text-fz-fg-subtle">·</span>
            <span className="text-fz-fg-subtle">
              {annotations.length} note{annotations.length === 1 ? '' : 's'}
            </span>
          </>
        )}
        {session && (
          <>
            <span className="text-fz-fg-subtle">·</span>
            {startedAt ? (
              <span className="text-fz-fg-muted">
                {elapsedMinutes.toFixed(1)} / {session.plan.availableMinutes} min
              </span>
            ) : (
              <button
                type="button"
                onClick={() => startSession()}
                className="rounded border border-fz-border px-2 py-0.5 text-[10px] text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg"
                title="Start the timer for this plan"
              >
                Start session
              </button>
            )}
            {currentSection && (
              <>
                <span className="text-fz-fg-subtle">·</span>
                <span
                  className={[
                    'rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider',
                    currentSection.mode === 'deep_read'
                      ? 'bg-fz-accent-2/20 text-fz-accent'
                      : currentSection.mode === 'skim'
                        ? 'bg-fz-fg-subtle/10 text-fz-fg-muted'
                        : 'bg-fz-bg text-fz-fg-subtle'
                  ].join(' ')}
                  title={currentSection.reason}
                >
                  {currentSection.mode.replace('_', ' ')}
                </span>
              </>
            )}
          </>
        )}
        <div className="flex-1" />
        {activeDocumentId && (
          <button
            type="button"
            onClick={() => setPlanModalOpen(true)}
            className="rounded border border-fz-border px-2 py-0.5 text-[10px] text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg"
            title="Plan this reading session (⌘⇧P)"
          >
            {session ? 'Re-plan' : 'Plan session'}
          </button>
        )}
        <span className="text-fz-fg-subtle">Fuzzy v0.1.0</span>
      </footer>
      {planModalOpen && activeDocumentId && (
        <ReadingPlanModal documentId={activeDocumentId} onClose={() => setPlanModalOpen(false)} />
      )}
    </>
  )
}
