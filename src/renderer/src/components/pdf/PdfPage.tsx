import { useEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'
import { usePdfStore } from '../../state/pdfStore'
import { useAnnotationStore } from '../../state/annotationStore'
import { useAppUiStore } from '../../state/appUiStore'
import { useTutorStore } from '../../state/tutorStore'
import { usePacerStore } from '../../state/pacerStore'
import { useReaderPrefsStore } from '../../state/readerPrefsStore'
import {
  buildPdfGeometry,
  locateSnippetRects,
  type ItemBox,
  type PdfGeometry
} from '../../lib/pdfWordGeometry'
import { ComplexWordOverlay } from './ComplexWordOverlay'
import type { AnnotationRecord } from '@shared/types/database'

interface Props {
  doc: PDFDocumentProxy
  documentId: string
  pageNumber: number
  scale: number
  onTextExtracted: (pageNumber: number, text: string) => void
}

// Renders a single PDF page with a real selectable text layer above the
// canvas. The text layer is what the user actually selects from — pdf.js
// places transparent absolutely-positioned spans at the right offsets so
// native browser selection works on top of the bitmap.
export function PdfPage({
  doc,
  documentId,
  pageNumber,
  scale,
  onTextExtracted
}: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  // Per-word boxes for this page (pacer / complex-word / thesis highlights),
  // derived from the rendered text-layer spans after each render.
  const [geometry, setGeometry] = useState<PdfGeometry | null>(null)
  const setPageText = usePdfStore((s) => s.setPageText)
  const cachedText = usePdfStore((s) => s.pageTexts.get(pageNumber))

  // Select the stable array reference, then derive the per-page subset with a
  // memo. Filtering *inside* the selector would return a fresh array on every
  // render, which makes zustand v5's useSyncExternalStore loop forever
  // ("Maximum update depth exceeded").
  const annotations = useAnnotationStore((s) => s.annotations)
  const annotationsForPage = useMemo(
    () =>
      annotations.filter(
        (a) => a.pageNumber === pageNumber && a.position?.rectsOnPage?.length
      ),
    [annotations, pageNumber]
  )
  const passageFlash = useAppUiStore((s) => s.passageFlash)
  const clearPassageFlash = useAppUiStore((s) => s.clearPassageFlash)
  const passageHighlight = useAppUiStore((s) => s.passageHighlight)
  const flashPassage = useAppUiStore((s) => s.flashPassage)
  const clearPassageHighlight = useAppUiStore((s) => s.clearPassageHighlight)
  const openFromAnnotation = useTutorStore((s) => s.openFromAnnotation)
  const complexitySensitivity = useReaderPrefsStore((s) => s.prefs.complexitySensitivity)

  const flashRects = useMemo(() => {
    if (!passageFlash || passageFlash.pageNumber !== pageNumber) return null
    return passageFlash.rectsOnPage
  }, [passageFlash, pageNumber])

  useEffect(() => {
    if (!flashRects) return
    const t = window.setTimeout(() => clearPassageFlash(), 750)
    return () => window.clearTimeout(t)
  }, [flashRects, clearPassageFlash])

  // Resolve a thesis "show in page" request: locate the snippet in this page's
  // word geometry and flash the exact rects (precise, full-fidelity highlight).
  useEffect(() => {
    if (!passageHighlight || !geometry) return
    if (passageHighlight.documentId !== documentId || passageHighlight.pageNumber !== pageNumber) {
      return
    }
    const rects = locateSnippetRects(geometry, passageHighlight.snippet)
    clearPassageHighlight()
    if (rects.length > 0) flashPassage({ pageNumber, rectsOnPage: rects })
  }, [
    passageHighlight,
    geometry,
    documentId,
    pageNumber,
    flashPassage,
    clearPassageHighlight
  ])

  useEffect(() => {
    let cancelled = false
    let renderTask: ReturnType<PDFPageProxy['render']> | null = null
    let textLayer: TextLayer | null = null

    async function render(): Promise<void> {
      const page = await doc.getPage(pageNumber)
      if (cancelled) return
      const viewport = page.getViewport({ scale })

      const canvas = canvasRef.current
      const textDiv = textLayerRef.current
      if (!canvas || !textDiv) return

      // Reset between renders so re-zoom doesn't double-up children.
      textDiv.innerHTML = ''

      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      setSize({ width: viewport.width, height: viewport.height })

      renderTask = page.render({ canvasContext: ctx, viewport, canvas })
      try {
        await renderTask.promise
      } catch (err) {
        // RenderingCancelledException is expected when scale changes mid-render.
        const name = (err as { name?: string } | null)?.name
        if (name !== 'RenderingCancelledException') {
          console.error('[fuzzy pdf] render error', err)
        }
        return
      }
      if (cancelled) return

      // Build the text layer for selection + extract a flat string.
      textDiv.style.width = `${viewport.width}px`
      textDiv.style.height = `${viewport.height}px`

      const textContent = await page.getTextContent()
      if (cancelled) return

      textLayer = new TextLayer({
        textContentSource: textContent,
        container: textDiv,
        viewport
      })
      try {
        await textLayer.render()
      } catch (err) {
        console.error('[fuzzy pdf] textLayer error', err)
      }

      // Build the flat string used by the AI request as nearby context.
      // pdfjs items have a `str` field; "items" with `hasEOL` insert newlines.
      const flat = textContent.items
        .map((item) => {
          if ('str' in item) {
            return (item as { str: string; hasEOL?: boolean }).hasEOL
              ? `${(item as { str: string }).str}\n`
              : (item as { str: string }).str
          }
          return ''
        })
        .join(' ')
        .replace(/\s+\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .trim()

      // Per-word geometry from the rendered spans. Read each text-layer span's
      // box relative to the layer, then subdivide into per-word rects. The flat
      // text it produces becomes the page's canonical text so the pacer /
      // highlighters tokenize the SAME string the rects are keyed against.
      let pageGeometry: PdfGeometry | null = null
      try {
        const layerRect = textDiv.getBoundingClientRect()
        const items: ItemBox[] = []
        for (const child of Array.from(textDiv.children)) {
          if (!(child instanceof HTMLElement)) continue
          const text = child.textContent ?? ''
          if (!text.trim()) continue
          const r = child.getBoundingClientRect()
          if (r.width <= 0 || r.height <= 0) continue
          items.push({
            text,
            left: r.left - layerRect.left,
            top: r.top - layerRect.top,
            width: r.width,
            height: r.height
          })
        }
        pageGeometry = buildPdfGeometry(items, { width: viewport.width, height: viewport.height })
      } catch (err) {
        console.error('[fuzzy pdf] geometry error', err)
      }
      if (cancelled) return

      const pageText = pageGeometry && pageGeometry.flatText.trim() ? pageGeometry.flatText : flat
      setGeometry(pageGeometry)
      setPageText(pageNumber, pageText)
      onTextExtracted(pageNumber, pageText)
    }

    render()

    return () => {
      cancelled = true
      if (renderTask) renderTask.cancel()
      if (textLayer) textLayer.cancel()
    }
  }, [doc, pageNumber, scale, onTextExtracted, setPageText])

  // Use cached text immediately if available so an action triggered before
  // a re-render still has page context. (Hook is harmless if effect re-runs.)
  void cachedText

  return (
    <div
      ref={containerRef}
      data-page-number={pageNumber}
      className="relative mx-auto rounded-md bg-white shadow-md"
      style={
        size
          ? { width: `${size.width}px`, height: `${size.height}px` }
          : { minHeight: 800, width: '100%', maxWidth: 900 }
      }
    >
      <canvas ref={canvasRef} className="block" />
      <div ref={textLayerRef} className="textLayer fz-text-layer absolute inset-0" />
      {size && (
        <>
          {geometry && <PacerWordOverlay geometry={geometry} pageSize={size} />}
          {geometry && complexitySensitivity !== 'off' && (
            <ComplexWordOverlay
              geometry={geometry}
              pageSize={size}
              documentId={documentId}
              pageNumber={pageNumber}
              sensitivity={complexitySensitivity}
            />
          )}
          {flashRects && flashRects.length > 0 && (
            <PassageFlashOverlay rects={flashRects} pageSize={size} />
          )}
          {annotationsForPage.length > 0 && (
            <MarginNoteOverlay
              annotations={annotationsForPage}
              pageSize={size}
              onOpenNote={openFromAnnotation}
            />
          )}
        </>
      )}
    </div>
  )
}

// Per-word pacer highlight on PDF. The pacer's active token index resolves
// against this page's geometry (same flat text was tokenized), so the sweep
// lands on the right word. Renders nothing when the pacer is idle or the
// active token isn't on this page.
function PacerWordOverlay({
  geometry,
  pageSize
}: {
  geometry: PdfGeometry
  pageSize: { width: number; height: number }
}): React.JSX.Element | null {
  const status = usePacerStore((s) => s.status)
  const animations = useReaderPrefsStore((s) => s.prefs.animations)
  const blobRef = useRef<HTMLDivElement>(null)
  const engaged = status === 'playing' || status === 'paused'

  // Continuous flow: instead of snapping per word and CSS-sliding (which stutters
  // — wait, glide, wait), we interpolate the blob's position EVERY frame from the
  // current word toward the next, synced to the reading pace. The blob is always
  // in motion, so the sweep reads like a current. We mutate the DOM directly in
  // the rAF loop (no React re-render per frame).
  useEffect(() => {
    if (!engaged) return
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const flow = animations && !reduce
    const W = pageSize.width
    const H = pageSize.height
    const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
    const smooth = (t: number): number => t * t * (3 - 2 * t)
    const padX = 4
    const padY = 3

    let raf = 0
    let lastPos = -1
    let startTs = 0

    const frame = (now: number): void => {
      const st = usePacerStore.getState()
      const el = blobRef.current
      if (el && st.words.length > 0) {
        const pos = st.position < 0 ? 0 : st.position
        const cur = st.words[pos]
        const curRect = cur ? geometry.rectByToken.get(cur.index) : undefined
        if (curRect) {
          if (pos !== lastPos) {
            lastPos = pos
            startTs = now
          }
          const dwell = Math.max(st.currentDelayMs(), 1)
          // Progress through the current word; frozen while paused or motion off.
          const t = flow && st.status === 'playing' ? Math.min(1, (now - startTs) / dwell) : 0
          const nextTok = st.words[pos + 1]
          const nextRect = nextTok ? geometry.rectByToken.get(nextTok.index) : undefined
          // Only glide toward the next word if it's on the same line — otherwise
          // we'd fly diagonally across a wrap. At a line end we ease to the word
          // and let the next frame pick up the new line.
          const sameLine = nextRect && Math.abs(nextRect.y - curRect.y) < curRect.height * 0.8
          const target = flow && sameLine ? nextRect! : curRect
          const et = smooth(t)
          const x = lerp(curRect.x, target.x, et) * W - padX
          const y = lerp(curRect.y, target.y, et) * H - padY
          const w = Math.max(lerp(curRect.width, target.width, et) * W, 6) + padX * 2
          const h = Math.max(curRect.height * H, 6) + padY * 2
          el.style.transform = `translate3d(${x}px, ${y}px, 0)`
          el.style.width = `${w}px`
          el.style.height = `${h}px`
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [engaged, geometry, pageSize.width, pageSize.height, animations])

  if (!engaged) return null

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[14]">
      <div
        ref={blobRef}
        className="fz-pace-glider absolute left-0 top-0"
        style={{ width: 6, height: 6, transform: 'translate3d(-9999px, -9999px, 0)' }}
      />
    </div>
  )
}

// Draws a translucent highlight over each saved annotation rect and a tiny
// gutter marker at the right edge of the page so users can spot annotated
// passages at a glance. Rects are normalised 0..1 against the page size,
// so re-zooming the page recomputes pixel positions for free.
function PassageFlashOverlay({
  rects,
  pageSize
}: {
  rects: Array<{ x: number; y: number; width: number; height: number }>
  pageSize: { width: number; height: number }
}): React.JSX.Element {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[15]">
      {rects.map((r, i) => (
        <div
          key={`flash:${i}`}
          className="fz-passage-flash absolute rounded-sm"
          style={{
            left: r.x * pageSize.width,
            top: r.y * pageSize.height,
            width: Math.max(r.width * pageSize.width, 2),
            height: Math.max(r.height * pageSize.height, 2),
            backgroundColor: 'var(--fz-accent-fill-strong)',
            boxShadow: '0 0 0 2px var(--fz-accent-ring-strong)'
          }}
        />
      ))}
    </div>
  )
}

function MarginNoteOverlay({
  annotations,
  pageSize,
  onOpenNote
}: {
  annotations: AnnotationRecord[]
  pageSize: { width: number; height: number }
  onOpenNote: (ann: AnnotationRecord) => void
}): React.JSX.Element {
  const blocks = useMemo(() => {
    const out: Array<{ key: string; left: number; top: number; width: number; height: number }> = []
    for (const ann of annotations) {
      const rects = ann.position?.rectsOnPage ?? []
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i]
        out.push({
          key: `${ann.id}:${i}`,
          left: r.x * pageSize.width,
          top: r.y * pageSize.height,
          width: r.width * pageSize.width,
          height: r.height * pageSize.height
        })
      }
    }
    return out
  }, [annotations, pageSize.width, pageSize.height])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10"
      style={{ width: pageSize.width, height: pageSize.height }}
    >
      {blocks.map((b) => (
        <div
          key={b.key}
          className="absolute rounded-sm"
          style={{
            left: b.left,
            top: b.top,
            width: Math.max(b.width, 2),
            height: Math.max(b.height, 2),
            backgroundColor: 'var(--fz-accent-tint)',
            boxShadow: 'inset 0 0 0 1px var(--fz-accent-ring)'
          }}
        />
      ))}
      {annotations.map((ann) => {
        const first = ann.position?.rectsOnPage?.[0]
        if (!first) return null
        return (
          <button
            key={`marker:${ann.id}`}
            type="button"
            className="absolute z-20 cursor-pointer rounded-full focus-visible:ring-2 focus-visible:ring-fz-accent"
            style={{
              right: -10,
              top: first.y * pageSize.height,
              width: 10,
              height: 10,
              backgroundColor: 'var(--fz-accent-marker)'
            }}
            title={ann.note.split('\n')[0]}
            aria-label="Open saved note in tutor"
            onClick={(e) => {
              e.stopPropagation()
              onOpenNote(ann)
            }}
          />
        )
      })}
    </div>
  )
}
