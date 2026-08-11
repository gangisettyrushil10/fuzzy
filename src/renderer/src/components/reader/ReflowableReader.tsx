import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PageRecord } from '@shared/types/database'
import type { AmbientClassification } from '@shared/types/api'
import { FILE_FORMATS, type FileType } from '@shared/formats'
import { useDocumentStore } from '../../state/documentStore'
import { useReaderLocationStore } from '../../state/readerLocationStore'
import { useSelectionStore } from '../../state/selectionStore'
import { usePacerStore } from '../../state/pacerStore'
import { useReaderPrefsStore } from '../../state/readerPrefsStore'
import { useComplexityStore } from '../../state/complexityStore'
import { useAppUiStore } from '../../state/appUiStore'
import { useFocusSessionStore } from '../../state/focusSessionStore'
import { useAmbientStore } from '../../state/ambientStore'
import { SelectionMenu } from '../pdf/SelectionMenu'
import { TokenizedText } from './TokenizedText'
import { ReaderTypographyPopover } from './ReaderTypographyPopover'
import { FeelingModeButton } from './FeelingModeButton'
import { SoundtrackButton } from './SoundtrackButton'
import { WordLayer } from '../../lib/domWordWrap'
import { normalizeRectsToPage } from '../../lib/rects'
import { tokenize, findWordSequence } from '../../lib/tokenize'
import { analyzeComplexity } from '../../lib/complexity'
import { isCommonWord } from '../../lib/frequencyList'
import { cn } from '../../lib/cn'
import { excerptForProgress } from '../../lib/ambientExcerpt'
import { moodlightClassificationDelay, moodlightExcerptChars } from '../../lib/moodlightSampling'

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
  const setReaderLocation = useReaderLocationStore((s) => s.setLocation)

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
    pacerPosition >= 0 && pacerPosition < pacerWords.length ? pacerWords[pacerPosition].index : -1

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

  useEffect(() => {
    if (!current) return
    setReaderLocation({
      documentId,
      currentPage: current.pageNumber,
      currentPageText: current.textContent ?? null
    })
  }, [documentId, current, setReaderLocation])

  // Rich (HTML) sections render sanitized book formatting; we then wrap their
  // words into a data-token-index span layer (WordLayer) so the pacer /
  // complex-word / thesis aids work over the formatted DOM exactly like the
  // plain TokenizedText path. `richSource` is the wrapped source string — the
  // canonical text the aids tokenize so their indices match the spans 1:1.
  const isRich = !!current?.htmlContent
  const layerRef = useRef<WordLayer | null>(null)
  const [richSource, setRichSource] = useState('')

  // Inject the sanitized HTML ourselves (not via dangerouslySetInnerHTML) and
  // build the word layer. Doing it imperatively keeps it idempotent under
  // StrictMode's double-invoke (we always reset from the raw HTML first).
  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    if (!current?.htmlContent) {
      layerRef.current = null
      setRichSource('')
      return
    }
    el.innerHTML = current.htmlContent
    // Strip any surviving inline styles so EPUB colour/font overrides can't
    // fight the reading theme (sanitize-html already does this server-side;
    // this is a client-side safety net for malformed or EPUB3 XHTML).
    el.querySelectorAll('[style]').forEach((node) => node.removeAttribute('style'))
    const layer = new WordLayer(el)
    layerRef.current = layer
    setRichSource(layer.source)
  }, [current])

  // Feed the current section's text to the pacer (only while it's engaged, so
  // we don't tokenize on every section turn otherwise). loadSource resets to
  // the top + stops when the section key changes. Rich sections feed the WRAPPED
  // source so the pacer's word indices resolve to real spans.
  useEffect(() => {
    if (!pacerVisible || !current) return
    const src = current.htmlContent ? richSource : (current.textContent ?? '')
    if (!src) return
    loadPacerSource(`${documentId}:${current.pageNumber}`, src)
  }, [pacerVisible, current, documentId, loadPacerSource, richSource])

  // Ambient auto-explain the hardest sentence in the current section (no-op
  // unless enabled; cached per section in the store).
  const ambientEnabled = useAmbientStore((s) => s.enabled)
  const runAmbient = useAmbientStore((s) => s.runForPage)
  useEffect(() => {
    if (!ambientEnabled || !current?.textContent) return
    void runAmbient(documentId, current.pageNumber, current.textContent)
  }, [ambientEnabled, current, documentId, runAmbient])

  const scrollRef = useRef<HTMLDivElement>(null)

  // New section always opens at the top — otherwise it inherits the previous
  // section's scroll offset.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [index])

  // Feeling classification follows the visible chunk of the section so the
  // shell ambience can drift with the scene instead of locking to one label.
  const feelingEnabled = useAmbientStore((s) => s.feelingEnabled)
  const feelingStatus = useAmbientStore((s) => s.feelingStatus)
  const ambientClassification = useAmbientStore((s) => s.classification)
  const setFeelingEnabled = useAmbientStore((s) => s.setFeelingEnabled)
  const previewForPage = useAmbientStore((s) => s.previewForPage)
  const classifyForPage = useAmbientStore((s) => s.classifyForPage)
  const setAmbientLive = useAmbientStore((s) => s.setLive)
  const classifyVisiblePassage = useCallback(async (): Promise<AmbientClassification | null> => {
    if (!current?.textContent) return null
    const host = scrollRef.current
    const progress =
      !host || host.scrollHeight <= host.clientHeight
        ? 0.5
        : host.scrollTop / Math.max(1, host.scrollHeight - host.clientHeight)
    const excerpt = excerptForProgress(current.textContent, progress)
    if (!excerpt) return null
    return classifyForPage(documentId, current.pageNumber, excerpt)
  }, [current, classifyForPage, documentId])
  const moodlightResponsiveness = useAmbientStore((s) => s.moodlightPreferences.responsiveness)
  useEffect(() => {
    if (!feelingEnabled || !current?.textContent) return
    const host = scrollRef.current
    let prevProgress = 0.5
    let classifyTimer: number | undefined

    const classifyFromScroll = (immediate = false): void => {
      const progress =
        !host || host.scrollHeight <= host.clientHeight
          ? 0.5
          : host.scrollTop / Math.max(1, host.scrollHeight - host.clientHeight)
      setAmbientLive(documentId, current.pageNumber, progress, progress - prevProgress)
      prevProgress = progress
      const excerpt = excerptForProgress(
        current.textContent ?? '',
        progress,
        moodlightExcerptChars(moodlightResponsiveness)
      )
      if (!excerpt) return
      previewForPage(documentId, current.pageNumber, excerpt)
      if (classifyTimer !== undefined) window.clearTimeout(classifyTimer)
      classifyTimer = window.setTimeout(
        () => {
          classifyTimer = undefined
          void classifyForPage(documentId, current.pageNumber, excerpt)
        },
        moodlightClassificationDelay(moodlightResponsiveness, immediate)
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
    current,
    documentId,
    previewForPage,
    classifyForPage,
    setAmbientLive,
    moodlightResponsiveness
  ])

  useEffect(() => {
    if (!feelingEnabled || !current) return
    setAmbientLive(documentId, current.pageNumber, 0.5, 0)
  }, [feelingEnabled, current, documentId, setAmbientLive])

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
    // Rich path: the word layer (built by the layout effect for this section)
    // owns the spans, so flash through it against the wrapped source.
    const layer = layerRef.current
    if (sections[targetIdx].htmlContent && layer) {
      layer.flash(findWordSequence(layer.source, snippet))
      return
    }
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
  // The string the reading aids tokenize: the wrapped source for rich sections
  // (indices must match the spans), else the plain section text.
  const aidSource = isRich ? richSource : sectionText
  const flaggedIndices = useMemo(() => {
    if (sensitivity === 'off' || !aidSource) return undefined
    return analyzeComplexity(tokenize(aidSource), sensitivity, isCommonWord).complexIndices
  }, [aidSource, sensitivity])

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

  // Rich path: drive the word layer imperatively (the plain path does this
  // declaratively through TokenizedText). Re-runs when richSource changes (a new
  // section was wrapped) or the aid input changes.
  useEffect(() => {
    if (!isRich) return
    layerRef.current?.setActive(activeWordIndex >= 0 ? activeWordIndex : null)
  }, [isRich, activeWordIndex, richSource])

  useEffect(() => {
    if (!isRich) return
    layerRef.current?.setFlagged(flaggedIndices ?? new Set<number>(), (word, rect) =>
      handleWordClick({ text: word }, rect)
    )
  }, [isRich, flaggedIndices, richSource, handleWordClick])

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
      <div className="fz-shell-chrome flex h-10 shrink-0 items-center gap-3 border-b border-fz-border px-3 text-xs">
        <span className="truncate text-fz-fg-muted" title={doc?.title}>
          {doc?.title ?? 'Untitled'}
        </span>
        <span className="rounded bg-fz-bg px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-fz-fg-subtle">
          {label}
        </span>
        <div className="flex-1" />
        <FeelingModeButton
          enabled={feelingEnabled}
          status={feelingStatus}
          classification={ambientClassification}
          onToggle={() => setFeelingEnabled(!feelingEnabled)}
        />
        <SoundtrackButton
          classification={ambientClassification}
          feelingEnabled={feelingEnabled}
          classifyVisiblePassage={classifyVisiblePassage}
        />
        <ReaderTypographyPopover />
        {sections && sections.length > 1 && (
          <div className="ml-3 flex items-center gap-1">
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

      <div className="relative flex-1 overflow-hidden bg-transparent">
        <div
          ref={scrollRef}
          className="flex h-full items-start justify-center overflow-auto p-8"
          style={{ position: 'relative', zIndex: 1, background: 'transparent' }}
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
            isRich ? (
              // Rich book formatting. The layout effect injects current.htmlContent
              // and wraps its words; React keeps the children empty (key forces a
              // fresh element when switching away from the plain path).
              <div
                key="rich"
                ref={contentRef}
                data-section-number={current.pageNumber}
                style={{
                  maxWidth: 'var(--fz-reader-width)',
                  background: 'var(--fz-reader-page-bg)',
                  position: 'relative',
                  zIndex: 1
                }}
                className={cn(
                  'fz-selectable prose-fz mx-auto w-full rounded-md p-10 shadow-md',
                  pacerEngaged && focusMode && 'fz-pace-dim'
                )}
              />
            ) : (
              <div
                key="plain"
                ref={contentRef}
                data-section-number={current.pageNumber}
                style={{
                  maxWidth: 'var(--fz-reader-width)',
                  background: 'var(--fz-reader-page-bg)',
                  position: 'relative',
                  zIndex: 1
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
                  wordClassName={(t) =>
                    flaggedIndices?.has(t.index) ? 'fz-complex-word' : undefined
                  }
                  onWordClick={handleWordClick}
                />
              </div>
            )
          ) : (
            <div className="max-w-md text-center text-xs text-fz-fg-muted">
              {extractorReady
                ? `Extracting text from this ${label.toLowerCase()}…`
                : `${label} text extraction is being built. The file is saved to your library and will open here once it ships.`}
            </div>
          )}
        </div>
        {/* end inner scroll container */}
      </div>
      {/* end non-scrolling wrapper */}

      <SelectionMenu />
    </div>
  )
}
