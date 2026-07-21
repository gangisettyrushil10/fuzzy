import { useState, useEffect } from 'react'
import { useDocuments } from '../../hooks/useDocuments'
import { useAnnotationStore } from '../../state/annotationStore'
import { usePdfStore } from '../../state/pdfStore'
import { useStudyPackStore } from '../../state/studyPackStore'
import { useAppUiStore } from '../../state/appUiStore'
import { useTutorStore } from '../../state/tutorStore'
import { useHighlightStore } from '../../state/highlightStore'
import { useObsidianStore } from '../../state/obsidianStore'
import { buildAiNoteBlock, buildHighlightBlock } from '@shared/obsidian'
import type { AnnotationRecord, PageRecord } from '@shared/types/database'

interface Props {
  onOpenStudyPack: () => void
  onCollapse: () => void
  style?: React.CSSProperties
}

export function LeftSidebar({ onOpenStudyPack, onCollapse, style }: Props): React.JSX.Element {
  const { documents, activeDocumentId, setActiveDocument, importDocument, importing } =
    useDocuments()
  const annotations = useAnnotationStore((s) => s.annotations)
  const setPage = usePdfStore((s) => s.setPage)
  const flashPassage = useAppUiStore((s) => s.flashPassage)
  const requestPassageHighlight = useAppUiStore((s) => s.requestPassageHighlight)
  const setHighlightsOpen = useAppUiStore((s) => s.setHighlightsOpen)
  const openFromAnnotation = useTutorStore((s) => s.openFromAnnotation)
  const pack = useStudyPackStore((s) => s.pack)
  const packLoading = useStudyPackStore((s) => s.loading)
  const highlightStats = useHighlightStore((s) => s.stats)
  const loadHighlightStats = useHighlightStore((s) => s.loadStats)
  const obsidianConnected = useObsidianStore((s) => s.status?.connected ?? false)

  const [sentAnnotationId, setSentAnnotationId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [chapterMap, setChapterMap] = useState<Record<string, PageRecord[]>>({})
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (activeDocumentId) {
      setExpandedIds((prev) => {
        if (prev.has(activeDocumentId)) return prev
        return new Set([...prev, activeDocumentId])
      })
    }
  }, [activeDocumentId])

  useEffect(() => {
    void loadHighlightStats()
  }, [loadHighlightStats])

  const toggleExpand = (docId: string): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(docId)) {
        next.delete(docId)
        return next
      }
      next.add(docId)
      return next
    })
    if (!chapterMap[docId] && !loadingIds.has(docId)) {
      setLoadingIds((prev) => new Set([...prev, docId]))
      window.fuzzy.pages
        .listForDocument(docId)
        .then((pages) => {
          setChapterMap((prev) => ({ ...prev, [docId]: pages }))
        })
        .catch(() => {
          setChapterMap((prev) => ({ ...prev, [docId]: [] }))
        })
        .finally(() => {
          setLoadingIds((prev) => {
            const s = new Set(prev)
            s.delete(docId)
            return s
          })
        })
    }
  }

  const navigateToChapter = (docId: string, fileType: string, pageNumber: number): void => {
    if (docId !== activeDocumentId) setActiveDocument(docId)
    if (fileType === 'pdf') {
      setPage(pageNumber)
    } else {
      requestPassageHighlight({ documentId: docId, pageNumber, snippet: '' })
    }
  }

  const chapterLabel = (page: PageRecord, index: number): string => {
    const first = page.textContent
      ?.split('\n')
      .find((l) => l.trim())
      ?.trim()
    if (first && first.length <= 80) return first
    return `Section ${index + 1}`
  }

  const navigateToNote = (a: AnnotationRecord): void => {
    const page = a.pageNumber ?? a.position?.pageNumber
    if (page) setPage(page)
    const rects = a.position?.rectsOnPage
    if (rects && rects.length > 0 && page) {
      flashPassage({ pageNumber: page, rectsOnPage: rects, annotationId: a.id })
    }
  }

  // Append a saved note/highlight into the document's Obsidian note. AI answers
  // use the AI block; everything else is treated as a highlight of the passage.
  const sendNoteToObsidian = (a: AnnotationRecord): void => {
    const block =
      a.annotationType === 'ai_note'
        ? buildAiNoteBlock({ text: a.note, selectedText: a.selectedText, pageNumber: a.pageNumber })
        : buildHighlightBlock({ text: a.selectedText, note: a.note, pageNumber: a.pageNumber })
    window.fuzzy.obsidian
      .appendNote(a.documentId, block)
      .then(() => {
        setSentAnnotationId(a.id)
        window.setTimeout(() => setSentAnnotationId((cur) => (cur === a.id ? null : cur)), 1600)
      })
      .catch((err) => console.error('[fuzzy] send note to Obsidian failed', err))
  }

  return (
    <aside className="fz-shell-chrome flex flex-col overflow-y-auto text-sm" style={style}>
      {/* Library header — always visible, scrolls with content */}
      <section className="border-b border-fz-border px-3 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-fz-fg-subtle">
            Library
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => importDocument()}
              disabled={importing}
              className="text-[10px] text-fz-fg-muted hover:text-fz-fg disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-fz-accent"
              title="Import a file (⌘O)"
            >
              {importing ? '…' : '+ import'}
            </button>
            <button
              type="button"
              onClick={onCollapse}
              className="flex h-5 w-5 items-center justify-center rounded text-fz-fg-subtle hover:bg-fz-bg hover:text-fz-fg focus-visible:ring-2 focus-visible:ring-fz-accent"
              title="Collapse sidebar"
            >
              ‹
            </button>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="text-xs text-fz-fg-muted">No documents yet</div>
        ) : (
          <ul className="space-y-0.5">
            {documents.map((doc) => {
              const isActive = doc.id === activeDocumentId
              const isExpanded = expandedIds.has(doc.id)
              const chapters = chapterMap[doc.id] ?? []
              const isLoading = loadingIds.has(doc.id)
              return (
                <li key={doc.id}>
                  <div
                    className={[
                      'flex items-center gap-0.5 rounded',
                      isActive
                        ? 'bg-[linear-gradient(90deg,rgba(232,135,74,0.14),rgba(124,92,255,0.13))]'
                        : ''
                    ]
                      .join(' ')
                      .trim()}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpand(doc.id)}
                      className="flex h-6 w-5 shrink-0 items-center justify-center text-fz-fg-subtle hover:text-fz-fg focus-visible:ring-2 focus-visible:ring-fz-accent"
                      title={isExpanded ? 'Collapse' : 'Show chapters'}
                    >
                      <span
                        className={[
                          'inline-block text-fz-micro transition-transform duration-150',
                          isExpanded ? 'rotate-90' : ''
                        ].join(' ')}
                      >
                        ›
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDocument(doc.id)}
                      className={[
                        'min-w-0 flex-1 truncate py-1 pr-2 text-left text-xs focus-visible:ring-2 focus-visible:ring-fz-accent',
                        isActive ? 'text-fz-fg' : 'text-fz-fg-muted hover:text-fz-fg'
                      ].join(' ')}
                      title={doc.title}
                    >
                      {doc.title}
                    </button>
                  </div>

                  {isExpanded && (
                    <ul className="mb-1 ml-5 mt-0.5 space-y-0.5 border-l border-fz-border pl-2">
                      {isLoading ? (
                        <li className="py-1 text-fz-micro text-fz-fg-subtle">Loading…</li>
                      ) : chapters.length === 0 ? (
                        <li className="py-1 text-fz-micro text-fz-fg-subtle">No sections</li>
                      ) : (
                        chapters.map((ch, i) => (
                          <li key={ch.id}>
                            <button
                              type="button"
                              onClick={() => navigateToChapter(doc.id, doc.fileType, ch.pageNumber)}
                              className="flex w-full items-baseline gap-1.5 rounded px-1.5 py-0.5 text-left hover:bg-fz-bg focus-visible:ring-2 focus-visible:ring-fz-accent"
                              title={chapterLabel(ch, i)}
                            >
                              <span className="shrink-0 text-[10px] tabular-nums text-fz-fg-subtle">
                                {ch.pageNumber}
                              </span>
                              <span className="truncate text-fz-micro text-fz-fg-muted hover:text-fz-fg">
                                {chapterLabel(ch, i)}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <SidebarSection title="Notes">
        {annotations.length === 0 ? (
          <EmptyHint>Saved notes appear here</EmptyHint>
        ) : (
          <ul className="space-y-1">
            {annotations.map((a) => (
              <li key={a.id} className="group relative">
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
                  <div className="line-clamp-2 text-fz-micro text-fz-fg-muted">
                    {a.selectedText}
                  </div>
                </button>
                {obsidianConnected && (
                  <button
                    type="button"
                    onClick={() => sendNoteToObsidian(a)}
                    className="absolute right-1 top-1 rounded bg-fz-bg/80 px-1.5 py-0.5 text-[10px] text-fz-fg-subtle opacity-0 transition hover:text-fz-fg focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-fz-accent group-hover:opacity-100"
                    title="Append this note to the document's Obsidian note"
                  >
                    {sentAnnotationId === a.id ? 'Sent ✓' : 'Obsidian ⤴'}
                  </button>
                )}
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
            className="w-full rounded border border-fz-border bg-fz-bg/40 px-2 py-1.5 text-left text-fz-micro hover:bg-fz-bg focus-visible:ring-2 focus-visible:ring-fz-accent"
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

      <SidebarSection title="Highlights">
        <button
          type="button"
          onClick={() => setHighlightsOpen(true)}
          className="w-full rounded border border-fz-border bg-fz-bg/40 px-2 py-1.5 text-left text-fz-micro hover:bg-fz-bg focus-visible:ring-2 focus-visible:ring-fz-accent"
          title="Open the highlight library"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-fz-fg">Open highlight library</span>
            {(highlightStats?.dueCount ?? 0) > 0 && (
              <span className="rounded-full border border-fz-accent/40 bg-fz-accent/10 px-2 py-0.5 text-[10px] text-fz-fg">
                {highlightStats?.dueCount} due
              </span>
            )}
          </div>
          <div className="mt-1 text-[10px] text-fz-fg-muted">
            {highlightStats?.total ?? 0} stored · import Kindle, Instapaper, Apple Books, and
            CSV/JSON exports
          </div>
        </button>
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
