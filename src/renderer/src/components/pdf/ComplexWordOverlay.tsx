import { useMemo } from 'react'
import type { PdfGeometry } from '../../lib/pdfWordGeometry'
import { tokenize } from '../../lib/tokenize'
import { analyzeComplexity, type ComplexitySensitivity } from '../../lib/complexity'
import { isCommonWord } from '../../lib/frequencyList'
import { useComplexityStore } from '../../state/complexityStore'

// Per-word complex-word underlines on PDF. Detection runs over the page's flat
// text (same string the geometry is keyed against), then each flagged word gets
// a thin dotted underline strip at its baseline. Only the strip is clickable
// (pointer-events on the strip, not the whole layer) so drag-select still
// starts on the text layer beneath.
export function ComplexWordOverlay({
  geometry,
  pageSize,
  documentId,
  pageNumber,
  sensitivity
}: {
  geometry: PdfGeometry
  pageSize: { width: number; height: number }
  documentId: string
  pageNumber: number
  sensitivity: ComplexitySensitivity
}): React.JSX.Element | null {
  const openPopover = useComplexityStore((s) => s.openPopover)

  const flagged = useMemo(() => {
    if (sensitivity === 'off') return []
    const tokens = tokenize(geometry.flatText)
    const { complexIndices } = analyzeComplexity(tokens, sensitivity, isCommonWord)
    const byIndex = new Map(tokens.map((t) => [t.index, t]))
    const out: Array<{ index: number; word: string; rect: { x: number; y: number; width: number; height: number } }> = []
    for (const index of complexIndices) {
      const rect = geometry.rectByToken.get(index)
      const tok = byIndex.get(index)
      if (rect && tok) out.push({ index, word: tok.text, rect })
    }
    return out
  }, [geometry, sensitivity])

  if (flagged.length === 0) return null

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[13]">
      {flagged.map(({ index, word, rect }) => (
        <button
          key={index}
          type="button"
          aria-label={`Define ${word}`}
          className="fz-complex-underline pointer-events-auto absolute"
          style={{
            left: rect.x * pageSize.width,
            top: (rect.y + rect.height) * pageSize.height - 2,
            width: Math.max(rect.width * pageSize.width, 4),
            height: 6,
            cursor: 'help'
          }}
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
            openPopover({
              word,
              documentId,
              pageNumber,
              contextText: geometry.flatText,
              anchor: { top: r.top, left: r.left, bottom: r.bottom, right: r.right }
            })
          }}
        />
      ))}
    </div>
  )
}
