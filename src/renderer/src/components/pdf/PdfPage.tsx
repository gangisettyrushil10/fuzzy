import { useEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'
import { usePdfStore } from '../../state/pdfStore'
import { useAnnotationStore } from '../../state/annotationStore'
import { useAppUiStore } from '../../state/appUiStore'
import { useTutorStore } from '../../state/tutorStore'
import type { AnnotationRecord } from '@shared/types/database'

interface Props {
  doc: PDFDocumentProxy
  pageNumber: number
  scale: number
  onTextExtracted: (pageNumber: number, text: string) => void
}

// Renders a single PDF page with a real selectable text layer above the
// canvas. The text layer is what the user actually selects from — pdf.js
// places transparent absolutely-positioned spans at the right offsets so
// native browser selection works on top of the bitmap.
export function PdfPage({ doc, pageNumber, scale, onTextExtracted }: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const setPageText = usePdfStore((s) => s.setPageText)
  const cachedText = usePdfStore((s) => s.pageTexts.get(pageNumber))

  const annotationsForPage = useAnnotationStore((s) =>
    s.annotations.filter((a) => a.pageNumber === pageNumber && a.position?.rectsOnPage?.length)
  )
  const passageFlash = useAppUiStore((s) => s.passageFlash)
  const clearPassageFlash = useAppUiStore((s) => s.clearPassageFlash)
  const openFromAnnotation = useTutorStore((s) => s.openFromAnnotation)

  const flashRects = useMemo(() => {
    if (!passageFlash || passageFlash.pageNumber !== pageNumber) return null
    return passageFlash.rectsOnPage
  }, [passageFlash, pageNumber])

  useEffect(() => {
    if (!flashRects) return
    const t = window.setTimeout(() => clearPassageFlash(), 750)
    return () => window.clearTimeout(t)
  }, [flashRects, clearPassageFlash])

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

      setPageText(pageNumber, flat)
      onTextExtracted(pageNumber, flat)
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
            backgroundColor: 'rgba(124, 92, 255, 0.55)',
            boxShadow: '0 0 0 2px rgba(183, 148, 244, 0.9)'
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
            backgroundColor: 'rgba(183, 148, 244, 0.22)',
            boxShadow: 'inset 0 0 0 1px rgba(124, 92, 255, 0.45)'
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
              backgroundColor: 'rgba(124, 92, 255, 0.9)'
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
