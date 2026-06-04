import type { NormalizedRect } from '../state/selectionStore'

// Plain DOMRect-shaped pair. Lets us unit-test the math without standing
// up jsdom — we just hand in plain numbers.
export interface RectLike {
  left: number
  top: number
  width: number
  height: number
}

// Compute page-normalised rects (0..1) for each line of a selection. Drops
// degenerate (zero-area) rects so we don't render dot markers for cursor
// position. Clamps to [0,1] so a selection that wraps slightly past the
// page edge still produces a sane overlay.
export function normalizeRectsToPage(
  rects: ReadonlyArray<RectLike>,
  page: { left: number; top: number; width: number; height: number }
): NormalizedRect[] {
  if (page.width <= 0 || page.height <= 0) return []
  const out: NormalizedRect[] = []
  for (const r of rects) {
    if (r.width <= 0 || r.height <= 0) continue
    const x = clamp01((r.left - page.left) / page.width)
    const y = clamp01((r.top - page.top) / page.height)
    const w = clamp01(r.width / page.width)
    const h = clamp01(r.height / page.height)
    if (w <= 0 || h <= 0) continue
    out.push({ x, y, width: w, height: h })
  }
  return out
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}
