import { useCallback, useEffect, useMemo, useRef } from 'react'
import { usePdfStore } from '../../state/pdfStore'
import { useSelectionStore } from '../../state/selectionStore'
import { useDocumentStore } from '../../state/documentStore'
import { usePacerStore } from '../../state/pacerStore'
import { useFocusSessionStore } from '../../state/focusSessionStore'
import { useAmbientStore } from '../../state/ambientStore'
import type { AmbientClassification } from '@shared/types/api'
import { PdfPage } from './PdfPage'
import { SelectionMenu } from './SelectionMenu'
import { ReaderTypographyPopover } from '../reader/ReaderTypographyPopover'
import { FeelingModeButton } from '../reader/FeelingModeButton'
import { excerptForProgress } from '../../lib/ambientExcerpt'
import { normalizeRectsToPage } from '../../lib/rects'

// Renders the active PDF, paginated. One page at a time keeps render work
// bounded and lets the selection menu reason about a single page's text.
export function PdfReader({ documentId }: { documentId: string }): React.JSX.Element {
  const {
    doc,
    pageCount,
    currentPage,
    scale,
    loading,
    error,
    loadForDocument,
    setPage,
    setScale,
    markPagePersisted,
    isPagePersisted
  } = usePdfStore()

  const documents = useDocumentStore((s) => s.documents)
  const activeDoc = useMemo(
    () => documents.find((d) => d.id === documentId) ?? null,
    [documents, documentId]
  )
  const setSelection = useSelectionStore((s) => s.setSelection)
  const clearSelection = useSelectionStore((s) => s.clear)

  // Pacer: feed the current page's text once it's extracted, while the pacer
  // is engaged. PdfPage's geometry uses the same flat text, so the sweep lines
  // up per word.
  const pacerVisible = usePacerStore((s) => s.visible)
  const loadPacerSource = usePacerStore((s) => s.loadSource)
  const pageText = usePdfStore((s) => s.pageTexts.get(currentPage))

  useEffect(() => {
    if (!pacerVisible || !pageText) return
    loadPacerSource(`${documentId}:${currentPage}`, pageText)
  }, [pacerVisible, pageText, documentId, currentPage, loadPacerSource])

  // Ambient auto-explain the hardest sentence on the current page (no-op unless
  // enabled; cached per page in the store).
  const ambientEnabled = useAmbientStore((s) => s.enabled)
  const runAmbient = useAmbientStore((s) => s.runForPage)
  useEffect(() => {
    if (!ambientEnabled || !pageText) return
    void runAmbient(documentId, currentPage, pageText)
  }, [ambientEnabled, pageText, documentId, currentPage, runAmbient])

  // Feeling classification (shared with the reflowable reader and shell background).
  const feelingEnabled = useAmbientStore((s) => s.feelingEnabled)
  const feelingStatus = useAmbientStore((s) => s.feelingStatus)
  const ambientClassification = useAmbientStore((s) => s.classification)
  const setFeelingEnabled = useAmbientStore((s) => s.setFeelingEnabled)
  const previewForPage = useAmbientStore((s) => s.previewForPage)
  const classifyForPage = useAmbientStore((s) => s.classifyForPage)
  const setAmbientLive = useAmbientStore((s) => s.setLive)

  const pagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadForDocument(documentId)
  }, [documentId, loadForDocument])

  // Stale selection menu: dismiss when page, zoom, or scroll changes.
  useEffect(() => {
    clearSelection()
  }, [currentPage, scale, clearSelection])

  // New page always opens at the top — otherwise it inherits the previous
  // page's scroll offset (e.g. landing at the bottom of page 13 after
  // finishing page 12 at its bottom).
  useEffect(() => {
    pagesContainerRef.current?.scrollTo({ top: 0 })
  }, [currentPage])

  // Count words read into the active focus session when leaving a page.
  const prevPageRef = useRef(currentPage)
  useEffect(() => {
    const prev = prevPageRef.current
    if (prev !== currentPage) {
      const fs = useFocusSessionStore.getState()
      if (fs.active) {
        const text = usePdfStore.getState().pageTexts.get(prev) ?? ''
        const words = text ? text.split(/\s+/).filter(Boolean).length : 0
        fs.notePageAdvance(words, currentPage)
      }
      prevPageRef.current = currentPage
    }
  }, [currentPage])

  useEffect(() => {
    const el = pagesContainerRef.current
    if (!el) return
    const onScroll = (): void => clearSelection()
    el.addEventListener('scroll', onScroll, { passive: true })
    const onResize = (): void => clearSelection()
    window.addEventListener('resize', onResize)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [clearSelection])

  useEffect(() => {
    if (!feelingEnabled || !pageText) return
    const host = pagesContainerRef.current
    let prevProgress = 0.5
    let classifyTimer: number | undefined

    const classifyFromScroll = (immediate = false): void => {
      const progress =
        !host || host.scrollHeight <= host.clientHeight
          ? 0.5
          : host.scrollTop / Math.max(1, host.scrollHeight - host.clientHeight)
      setAmbientLive(documentId, currentPage, progress, progress - prevProgress)
      prevProgress = progress
      const excerpt = excerptForProgress(pageText, progress)
      if (!excerpt) return
      previewForPage(documentId, currentPage, excerpt)
      if (classifyTimer !== undefined) window.clearTimeout(classifyTimer)
      classifyTimer = window.setTimeout(
        () => {
          classifyTimer = undefined
          void classifyForPage(documentId, currentPage, excerpt)
        },
        immediate ? 360 : 760
      )
    }

    classifyFromScroll(true)
    if (!host) {
      return () => {
        if (classifyTimer !== undefined) window.clearTimeout(classifyTimer)
      }
    }

    const onScroll = (): void => classifyFromScroll()
    host.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      host.removeEventListener('scroll', onScroll)
      if (classifyTimer !== undefined) window.clearTimeout(classifyTimer)
    }
  }, [
    feelingEnabled,
    pageText,
    documentId,
    currentPage,
    previewForPage,
    classifyForPage,
    setAmbientLive
  ])

  useEffect(() => {
    if (!feelingEnabled) return
    setAmbientLive(documentId, currentPage, 0.5, 0)
  }, [feelingEnabled, documentId, currentPage, setAmbientLive])

  // Persist extracted text per page, as soon as it lands. Partial reading
  // sessions still keep their pages because each one ships immediately
  // instead of waiting on a "saw all pages" sentinel.
  const handleTextExtracted = useCallback(
    (pageNumber: number, text: string) => {
      if (isPagePersisted(pageNumber)) return
      const estimatedWordCount = text.trim() ? text.split(/\s+/).filter(Boolean).length : 0
      window.fuzzy.documents
        .recordPageExtraction(documentId, {
          pageNumber,
          textContent: text,
          estimatedWordCount
        })
        .then(() => markPagePersisted(pageNumber))
        .catch((err) => console.error('[fuzzy pdf] recordPageExtraction failed', err))
    },
    [documentId, isPagePersisted, markPagePersisted]
  )

  // Capture text selections inside the page text layer. The PDF.js text
  // layer wraps real spans, so window.getSelection() works directly.
  const handleMouseUp = useCallback(() => {
    const win = window.getSelection()
    const text = win?.toString().trim() ?? ''
    if (!text || !win || win.rangeCount === 0) {
      clearSelection()
      return
    }
    const range = win.getRangeAt(0)
    const node = (range.startContainer as HTMLElement | null) ?? null
    const pageEl = (node?.parentElement?.closest?.('[data-page-number]') ??
      null) as HTMLElement | null
    if (!pageEl) {
      clearSelection()
      return
    }
    const pageNumber = Number(pageEl.dataset.pageNumber)
    if (!Number.isFinite(pageNumber)) {
      clearSelection()
      return
    }
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      clearSelection()
      return
    }
    const pageRect = pageEl.getBoundingClientRect()
    // One client rect per line of the selection — better than a single
    // bounding box when the highlight spans multiple lines.
    const rectsOnPage = normalizeRectsToPage(Array.from(range.getClientRects()), {
      left: pageRect.left,
      top: pageRect.top,
      width: pageRect.width,
      height: pageRect.height
    })
    // Pause the sweep when the reader starts grabbing a quote.
    if (usePacerStore.getState().status === 'playing') usePacerStore.getState().pause()
    setSelection({
      documentId,
      pageNumber,
      text,
      anchorRect: {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right
      },
      rectsOnPage
    })
  }, [documentId, setSelection, clearSelection])

  // Keyboard nav: arrows + page up/down. Skip when the user is typing.
  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        setPage(currentPage + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        setPage(currentPage - 1)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [currentPage, setPage])

  if (loading) {
    return (
      <ReaderShell title={activeDoc?.title}>
        <div className="flex flex-col items-center gap-2">
          <span className="fz-spinner inline-block h-4 w-4 rounded-full border-2 border-fz-accent border-t-transparent" />
          <div className="text-xs text-fz-fg-muted">Opening PDF…</div>
        </div>
      </ReaderShell>
    )
  }
  if (error) {
    return (
      <ReaderShell title={activeDoc?.title}>
        <div className="max-w-md text-center text-xs text-fz-danger">{error}</div>
      </ReaderShell>
    )
  }
  if (!doc) {
    return (
      <ReaderShell title={activeDoc?.title}>
        <div className="text-xs text-fz-fg-muted">Loading…</div>
      </ReaderShell>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PdfToolbar
        title={activeDoc?.title}
        currentPage={currentPage}
        pageCount={pageCount}
        scale={scale}
        feelingEnabled={feelingEnabled}
        feelingStatus={feelingStatus}
        ambientClassification={ambientClassification}
        onFeelingToggle={() => setFeelingEnabled(!feelingEnabled)}
        onPrev={() => setPage(currentPage - 1)}
        onNext={() => setPage(currentPage + 1)}
        onZoomIn={() => setScale(scale + 0.1)}
        onZoomOut={() => setScale(scale - 0.1)}
      />
      <div className="relative flex-1 overflow-hidden bg-transparent">
        <div
          ref={pagesContainerRef}
          onMouseUp={handleMouseUp}
          className="fz-selectable flex h-full justify-center overflow-auto p-8"
          style={{ position: 'relative', zIndex: 1, background: 'transparent' }}
        >
          <div style={{ position: 'relative', zIndex: 1 }}>
            <PdfPage
              doc={doc}
              documentId={documentId}
              pageNumber={currentPage}
              scale={scale}
              onTextExtracted={handleTextExtracted}
            />
          </div>
        </div>
      </div>
      <SelectionMenu />
    </div>
  )
}

function PdfToolbar({
  title,
  currentPage,
  pageCount,
  scale,
  feelingEnabled,
  feelingStatus,
  ambientClassification,
  onFeelingToggle,
  onPrev,
  onNext,
  onZoomIn,
  onZoomOut
}: {
  title?: string
  currentPage: number
  pageCount: number
  scale: number
  feelingEnabled: boolean
  feelingStatus: 'idle' | 'classifying' | 'ready' | 'error'
  ambientClassification: AmbientClassification | null
  onFeelingToggle: () => void
  onPrev: () => void
  onNext: () => void
  onZoomIn: () => void
  onZoomOut: () => void
}): React.JSX.Element {
  return (
    <div className="fz-shell-chrome flex h-10 shrink-0 items-center gap-3 border-b border-fz-border px-3 text-xs">
      <span className="truncate text-fz-fg-muted" title={title}>
        {title ?? 'Untitled'}
      </span>
      <div className="flex-1" />
      <FeelingModeButton
        enabled={feelingEnabled}
        status={feelingStatus}
        classification={ambientClassification}
        onToggle={onFeelingToggle}
      />
      <div className="flex items-center gap-1">
        <ToolbarButton onClick={onPrev} disabled={currentPage <= 1} label="Prev" />
        <span className="w-20 text-center text-fz-micro text-fz-fg-muted">
          {currentPage} / {pageCount}
        </span>
        <ToolbarButton onClick={onNext} disabled={currentPage >= pageCount} label="Next" />
      </div>
      <div className="ml-3">
        <ReaderTypographyPopover />
      </div>
      <div className="ml-3 flex items-center gap-1">
        <ToolbarButton onClick={onZoomOut} label="–" disabled={scale <= 0.5} />
        <span className="w-12 text-center text-fz-micro text-fz-fg-muted">
          {Math.round(scale * 100)}%
        </span>
        <ToolbarButton onClick={onZoomIn} label="+" disabled={scale >= 3} />
      </div>
    </div>
  )
}

function ToolbarButton({
  label,
  onClick,
  disabled
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-fz-border px-2 py-0.5 text-fz-micro text-fz-fg-muted hover:bg-fz-bg disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  )
}

function ReaderShell({
  title,
  children
}: {
  title?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center border-b border-fz-border bg-fz-surface-2 px-3 text-xs text-fz-fg-muted">
        {title ?? 'Untitled'}
      </div>
      <div className="flex flex-1 items-center justify-center">{children}</div>
    </div>
  )
}
