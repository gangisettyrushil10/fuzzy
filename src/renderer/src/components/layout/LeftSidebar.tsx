import { useDocuments } from '../../hooks/useDocuments'
import { useAnnotationStore } from '../../state/annotationStore'
import { usePdfStore } from '../../state/pdfStore'
import { useStudyPackStore } from '../../state/studyPackStore'
import { useAppUiStore } from '../../state/appUiStore'
import { useTutorStore } from '../../state/tutorStore'
import type { AnnotationRecord } from '@shared/types/database'

interface Props {
  onOpenStudyPack: () => void
}

export function LeftSidebar({ onOpenStudyPack }: Props): React.JSX.Element {
  const { documents, activeDocumentId, setActiveDocument, importDocument, importing } =
    useDocuments()
  const annotations = useAnnotationStore((s) => s.annotations)
  const setPage = usePdfStore((s) => s.setPage)
  const flashPassage = useAppUiStore((s) => s.flashPassage)
  const openFromAnnotation = useTutorStore((s) => s.openFromAnnotation)
  const pack = useStudyPackStore((s) => s.pack)
  const packLoading = useStudyPackStore((s) => s.loading)

  const navigateToNote = (a: AnnotationRecord): void => {
    const page = a.pageNumber ?? a.position?.pageNumber
    if (page) setPage(page)
    const rects = a.position?.rectsOnPage
    if (rects && rects.length > 0 && page) {
      flashPassage({ pageNumber: page, rectsOnPage: rects, annotationId: a.id })
    }
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-fz-surface-2 text-sm">
      <SidebarSection
        title="Library"
        action={
          <button
            type="button"
            onClick={() => importDocument()}
            disabled={importing}
            className="text-[10px] text-fz-fg-muted hover:text-fz-fg disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-fz-accent"
            title="Import a PDF (⌘O)"
          >
            {importing ? '…' : '+ import'}
          </button>
        }
      >
        {documents.length === 0 ? (
          <EmptyHint>No documents yet</EmptyHint>
        ) : (
          <ul className="space-y-0.5">
            {documents.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => setActiveDocument(doc.id)}
                  className={[
                    'w-full truncate rounded px-2 py-1 text-left text-xs focus-visible:ring-2 focus-visible:ring-fz-accent',
                    doc.id === activeDocumentId
                      ? 'bg-fz-accent-2/20 text-fz-fg'
                      : 'text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg'
                  ].join(' ')}
                  title={doc.title}
                >
                  {doc.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </SidebarSection>
      <SidebarSection title="Notes">
        {annotations.length === 0 ? (
          <EmptyHint>Saved notes appear here</EmptyHint>
        ) : (
          <ul className="space-y-1">
            {annotations.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => navigateToNote(a)}
                  onDoubleClick={() => openFromAnnotation(a)}
                  className="w-full rounded px-2 py-1 text-left hover:bg-fz-bg focus-visible:ring-2 focus-visible:ring-fz-accent"
                  title={`${a.note}\n\nDouble-click to open in tutor`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-fz-fg-subtle">
                    <span>
                      {a.annotationType === 'ai_note' ? 'AI' : 'Note'}
                      {a.pageNumber ? ` · p.${a.pageNumber}` : ''}
                    </span>
                  </div>
                  <div className="line-clamp-2 text-[11px] text-fz-fg-muted">{a.selectedText}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SidebarSection>
      <SidebarSection title="Study Pack">
        {!activeDocumentId ? (
          <EmptyHint>Open a document to build one</EmptyHint>
        ) : (
          <button
            type="button"
            onClick={onOpenStudyPack}
            className="w-full rounded border border-fz-border bg-fz-bg/40 px-2 py-1.5 text-left text-[11px] hover:bg-fz-bg focus-visible:ring-2 focus-visible:ring-fz-accent"
            title={pack ? 'Open the saved study pack (⌘⇧S)' : 'Generate a study pack (⌘⇧S)'}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-fz-fg">
                {pack ? 'Open study pack' : 'Build study pack'}
              </span>
              {packLoading && <span className="text-[10px] text-fz-fg-subtle">loading…</span>}
            </div>
            {pack && (
              <div className="mt-1 text-[10px] text-fz-fg-muted">
                {pack.flashcards.length} cards · {pack.quiz.length} questions
              </div>
            )}
          </button>
        )}
      </SidebarSection>
    </aside>
  )
}

function SidebarSection({
  title,
  action,
  children
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="border-b border-fz-border px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-fz-fg-subtle">
          {title}
        </span>
        {action}
      </div>
      {children}
    </section>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="text-xs text-fz-fg-muted">{children}</div>
}
