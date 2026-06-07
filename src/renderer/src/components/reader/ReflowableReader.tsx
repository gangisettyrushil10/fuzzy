import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PageRecord } from '@shared/types/database'
import { FILE_FORMATS, type FileType } from '@shared/formats'
import { useDocumentStore } from '../../state/documentStore'
import { useSelectionStore } from '../../state/selectionStore'
import { usePacerStore } from '../../state/pacerStore'
import { useReaderPrefsStore } from '../../state/readerPrefsStore'
import { useComplexityStore } from '../../state/complexityStore'
import { useAppUiStore } from '../../state/appUiStore'
import { useFocusSessionStore } from '../../state/focusSessionStore'
import { SelectionMenu } from '../pdf/SelectionMenu'
import { TokenizedText } from './TokenizedText'
import { normalizeRectsToPage } from '../../lib/rects'
import { tokenize, findWordSequence } from '../../lib/tokenize'
import { analyzeComplexity } from '../../lib/complexity'
import { isCommonWord } from '../../lib/frequencyList'
import { cn } from '../../lib/cn'

// One reader for every reflowable format (epub, txt, md, docx, mobi). It does
// NOT parse the source file — the main-process extractor already turned it into
// ordered text "sections" stored in the pages table. This reader loads those
// sections, paginates them, and wires text selection into the AI tutor exactly
// like the PDF reader does. Rich rendering (images/layout) can come later;
// this gives a functional read+select+AI loop for all formats uniformly.
export function ReflowableReader({
  documentId,
  fileType
}: {
  documentId: string
  fileType: FileType
}): React.JSX.Element {
  const documents = useDocumentStore((s) => s.documents)
  const doc = useMemo(
    () => documents.find((d) => d.id === documentId) ?? null,
    [documents, documentId]
  )
  const setSelection = useSelectionStore((s) => s.setSelection)
  const clearSelection = useSelectionStore((s) => s.clear)

  // WPM pacer integration (word-by-word sweep over this section's text).
  const pacerVisible = usePacerStore((s) => s.visible)
  const pacerStatus = usePacerStore((s) => s.status)
  const pacerPosition = usePacerStore((s) => s.position)
  const pacerWords = usePacerStore((s) => s.words)
  const loadPacerSource = usePacerStore((s) => s.loadSource)
  const pausePacer = usePacerStore((s) => s.pause)
  const focusMode = useReaderPrefsStore((s) => s.prefs.focusMode)

  const pacerEngaged = pacerStatus === 'playing' || pacerStatus === 'paused'
  const activeWordIndex =
    pacerPosition >= 0 && pacerPosition < pacerWords.length
      ? pacerWords[pacerPosition].index
      : -1

  // Complex-word detection over this section's text (memoized; pure).
  const sensitivity = useReaderPrefsStore((s) => s.prefs.complexitySensitivity)
  const openPopover = useComplexityStore((s) => s.openPopover)

  // This component is keyed by documentId in DocumentReader, so it remounts
  // per document and initial state is the correct starting point — no need to
  // reset synchronously inside the effect.
  const [sections, setSections] = useState<PageRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [highlightIndices, setHighlightIndices] = useState<Set<number> | undefined>(undefined)
  const contentRef = useRef<HTMLDivElement>(null)

  // Thesis "go to source": navigate to the section + flash the matched words.
  const passageHighlight = useAppUiStore((s) => s.passageHighlight)
  const clearPassageHighlight = useAppUiStore((s) => s.clearPassageHighlight)

  const label = FILE_FORMATS[fileType].label
  const extractorReady = FILE_FORMATS[fileType].extractorReady

  useEffect(() => {
    let cancelled = false
    window.fuzzy.pages
      .listForDocument(documentId)
      .then((pages) => {
        if (cancelled) return
        setSections(pages)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load document text')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [documentId])

  // Re-poll briefly while background extraction is still landing sections.
  const sectionCount = sections?.length ?? 0
  useEffect(() => {
    if (!extractorReady || sectionCount > 0 || loading) return
    const t = window.setInterval(() => {
      window.fuzzy.pages
        .listForDocument(documentId)
        .then((pages) => {
          if (pages.length > 0) setSections(pages)
        })
        .catch(() => undefined)
    }, 1500)
    return () => window.clearInterval(t)
  }, [documentId, extractorReady, sectionCount, loading])

  useEffect(() => {
    clearSelection()
  }, [index, clearSelection])

  // Count words read into the active focus session when leaving a section.
  const prevIndexRef = useRef(index)
  useEffect(() => {
    const prev = prevIndexRef.current
    if (prev !== index) {
      const fs = useFocusSessionStore.getState()
      if (fs.active && sections) {
        fs.notePageAdvance(sections[prev]?.estimatedWordCount ?? 0, index + 1)
      }
      prevIndexRef.current = index
    }
  }, [index, sections])

  const current = sections && sections.length > 0 ? sections[index] : null

  // Feed the current section's text to the pacer (only while it's engaged, so
  // we don't tokenize on every section turn otherwise). loadSource resets to
  // the top + stops when the section key changes.
  useEffect(() => {
    if (!pacerVisible || !current) return
    loadPacerSource(`${documentId}:${current.pageNumber}`, current.textContent ?? '')
  }, [pacerVisible, current, documentId, loadPacerSource])

  // Resolve a thesis highlight request: hop to the right section, then flash
  // the matched words once it's rendered. Two-pass via the `index` dep — first
  // run navigates, second run (on the target section) does the highlight.
  useEffect(() => {
    if (!passageHighlight || passageHighlight.documentId !== documentId || !sections) return
    const targetIdx = sections.findIndex((s) => s.pageNumber === passageHighlight.pageNumber)
    if (targetIdx < 0) {
      clearPassageHighlight()
      return
    }
    if (targetIdx !== index) {
      setIndex(targetIdx)
      return
    }
    const snippet = passageHighlight.snippet
    clearPassageHighlight()
    const indices = findWordSequence(sections[targetIdx].textContent ?? '', snippet)
    if (indices.length === 0) return
    setHighlightIndices(new Set(indices))
    requestAnimationFrame(() => {
      contentRef.current
        ?.querySelector(`[data-token-index="${indices[0]}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    const timer = window.setTimeout(() => setHighlightIndices(undefined), 1800)
    return () => window.clearTimeout(timer)
  }, [passageHighlight, sections, index, documentId, clearPassageHighlight])

  const sectionText = current?.textContent ?? ''
  const flaggedIndices = useMemo(() => {
    if (sensitivity === 'off' || !sectionText) return undefined
    return analyzeComplexity(tokenize(sectionText), sensitivity, isCommonWord).complexIndices
  }, [sectionText, sensitivity])

  const handleWordClick = useCallback(
    (token: { text: string }, rect: DOMRect) => {
      openPopover({
        word: token.text,
        documentId,
        pageNumber: current ? current.pageNumber : index + 1,
        contextText: sectionText,
        anchor: { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right }
      })
    },
    [openPopover, documentId, current, index, sectionText]
  )

  const handleMouseUp = useCallback(() => {
    const win = window.getSelection()
    const text = win?.toString().trim() ?? ''
    if (!text || !win || win.rangeCount === 0) {
      clearSelection()
      return
    }
    const range = win.getRangeAt(0)
    const containerEl = contentRef.current
    if (!containerEl || !containerEl.contains(range.commonAncestorContainer)) {
      clearSelection()
      return
    }
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      clearSelection()
      return
    }
    const boxRect = containerEl.getBoundingClientRect()
    const rectsOnPage = normalizeRectsToPage(Array.from(range.getClientRects()), {
      left: boxRect.left,
      top: boxRect.top,
      width: boxRect.width,
      height: boxRect.height
    })
    // Reading and selecting are different intents — pause the sweep so the
    // highlight doesn't run away while the user grabs a quote.
    if (pacerStatus === 'playing') pausePacer()
    setSelection({
      documentId,
      pageNumber: current ? current.pageNumber : index + 1,
      text,
      anchorRect: { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right },
      rectsOnPage,
      contextText: current?.textContent ?? null
    })
  }, [documentId, current, index, setSelection, clearSelection, pacerStatus, pausePacer])

  const go = useCallback(
    (next: number) => {
      const max = (sections?.length ?? 1) - 1
      setIndex(Math.min(Math.max(next, 0), Math.max(max, 0)))
    },
    [sections]
  )

  // Keyboard nav between sections (skip when typing).
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        go(index + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go(index - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, go])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-fz-border bg-fz-surface-2 px-3 text-xs">
        <span className="truncate text-fz-fg-muted" title={doc?.title}>
          {doc?.title ?? 'Untitled'}
        </span>
        <span className="rounded bg-fz-bg px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-fz-fg-subtle">
          {label}
        </span>
        <div className="flex-1" />
        {sections && sections.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index <= 0}
              className="rounded border border-fz-border px-2 py-0.5 text-[11px] text-fz-fg-muted hover:bg-fz-bg disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <span className="w-20 text-center text-[11px] text-fz-fg-muted">
              {index + 1} / {sections.length}
            </span>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index >= sections.length - 1}
              className="rounded border border-fz-border px-2 py-0.5 text-[11px] text-fz-fg-muted hover:bg-fz-bg disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <div
        className="flex flex-1 justify-center overflow-auto bg-fz-bg p-8"
        onMouseUp={handleMouseUp}
      >
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-fz-fg-muted">
            <span className="fz-spinner inline-block h-4 w-4 rounded-full border-2 border-fz-accent border-t-transparent" />
            Opening {label}…
          </div>
        ) : error ? (
          <div className="max-w-md text-center text-xs text-fz-danger">{error}</div>
        ) : current ? (
          <div
            ref={contentRef}
            data-section-number={current.pageNumber}
            style={{
              maxWidth: 'var(--fz-reader-width)',
              background: 'var(--fz-reader-page-bg)'
            }}
            className={cn(
              'fz-selectable prose-fz mx-auto w-full whitespace-pre-wrap rounded-md p-10 shadow-md',
              pacerEngaged && focusMode && 'fz-pace-dim'
            )}
          >
            <TokenizedText
              text={current.textContent ?? ''}
              spanMode={pacerEngaged ? 'all' : 'flagged'}
              activeWordIndex={activeWordIndex}
              flaggedIndices={flaggedIndices}
              highlightIndices={highlightIndices}
              wordClassName={(t) => (flaggedIndices?.has(t.index) ? 'fz-complex-word' : undefined)}
              onWordClick={handleWordClick}
            />
          </div>
        ) : (
          <div className="max-w-md text-center text-xs text-fz-fg-muted">
            {extractorReady
              ? `Extracting text from this ${label.toLowerCase()}…`
              : `${label} text extraction is being built. The file is saved to your library and will open here once it ships.`}
          </div>
        )}
      </div>

      <SelectionMenu />
    </div>
  )
}
