// Draws a branded, shareable excerpt card straight onto a <canvas> — no DOM
// screenshot library. We already have the theme's raw colors, so we can
// control layout completely; the only real complexity is word-wrapping and
// fitting variable-length excerpts into a fixed card.

export interface ShareCardInput {
  excerptText: string
  sourceTitle: string
  sourceAuthor?: string | null
  pageNumber?: number | null
  bgHex: string
  fgHex: string
  mutedHex: string
  accentHex: string
}

const CARD_WIDTH = 1200
const CARD_HEIGHT = 630
const RENDER_SCALE = 2
const PADDING = 72
const FOOTER_HEIGHT = 90
const MAX_EXCERPT_CHARS = 420

// Canvas fillStyle can't parse every CSS color form our theme system may hand
// it (e.g. the custom-accent path returns a `color-mix(...)` string). Route
// anything through a throwaway element so the browser resolves it to rgb().
function resolveCssColor(color: string): string {
  if (typeof document === 'undefined') return color
  const probe = document.createElement('div')
  probe.style.color = color
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  document.body.removeChild(probe)
  return resolved || color
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

async function ensureFontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await Promise.all([
      document.fonts.load('500 44px "Literata Variable"'),
      document.fonts.load('700 20px "Inter Variable"')
    ])
    await document.fonts.ready
  } catch {
    // Best effort — draw with whatever is loaded rather than block forever.
  }
}

export async function renderShareCardToCanvas(
  canvas: HTMLCanvasElement,
  input: ShareCardInput
): Promise<void> {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = CARD_WIDTH * RENDER_SCALE
  canvas.height = CARD_HEIGHT * RENDER_SCALE
  canvas.style.width = `${CARD_WIDTH}px`
  canvas.style.height = `${CARD_HEIGHT}px`
  ctx.scale(RENDER_SCALE, RENDER_SCALE)
  ctx.textBaseline = 'alphabetic'

  await ensureFontsReady()

  const bg = resolveCssColor(input.bgHex)
  const fg = resolveCssColor(input.fgHex)
  const muted = resolveCssColor(input.mutedHex)
  const accent = resolveCssColor(input.accentHex)

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // Accent bar down the left edge.
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, 8, CARD_HEIGHT)

  // Opening quote flourish.
  ctx.fillStyle = accent
  ctx.font = '700 96px Georgia, serif'
  ctx.fillText('“', PADDING - 8, PADDING + 70)

  const textLeft = PADDING
  const textWidth = CARD_WIDTH - PADDING * 2
  const textTop = PADDING + 110
  const availableHeight = CARD_HEIGHT - textTop - FOOTER_HEIGHT

  const excerpt =
    input.excerptText.length > MAX_EXCERPT_CHARS
      ? `${input.excerptText.slice(0, MAX_EXCERPT_CHARS - 1).trimEnd()}…`
      : input.excerptText

  ctx.fillStyle = fg
  let fontSize = 44
  let lines: string[] = []
  let lineHeight = fontSize * 1.35
  while (fontSize >= 22) {
    ctx.font = `500 ${fontSize}px "Literata Variable", Georgia, serif`
    lines = wrapText(ctx, excerpt, textWidth)
    lineHeight = fontSize * 1.35
    if (lines.length * lineHeight <= availableHeight) break
    fontSize -= 2
  }
  const maxLines = Math.max(1, Math.floor(availableHeight / lineHeight))
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines)
    const last = lines[maxLines - 1].replace(/\s+\S*$/, '')
    lines[maxLines - 1] = `${last}…`
  }
  lines.forEach((line, i) => {
    ctx.fillText(line, textLeft, textTop + i * lineHeight)
  })

  const sourceY = CARD_HEIGHT - FOOTER_HEIGHT
  ctx.strokeStyle = muted
  ctx.globalAlpha = 0.3
  ctx.beginPath()
  ctx.moveTo(textLeft, sourceY - 24)
  ctx.lineTo(CARD_WIDTH - PADDING, sourceY - 24)
  ctx.stroke()
  ctx.globalAlpha = 1

  ctx.fillStyle = muted
  ctx.font = '500 22px "Inter Variable", system-ui, sans-serif'
  const byline = input.sourceAuthor
    ? `"${input.sourceTitle}" — ${input.sourceAuthor}`
    : `"${input.sourceTitle}"`
  ctx.fillText(byline, textLeft, sourceY)

  if (input.pageNumber != null) {
    const pageLabel = `Page ${input.pageNumber}`
    const w = ctx.measureText(pageLabel).width
    ctx.fillText(pageLabel, CARD_WIDTH - PADDING - w, sourceY)
  }

  ctx.fillStyle = accent
  ctx.font = '700 20px "Inter Variable", system-ui, sans-serif'
  const wordmark = 'fuzzy'
  const wmWidth = ctx.measureText(wordmark).width
  ctx.fillText(wordmark, CARD_WIDTH - PADDING - wmWidth, CARD_HEIGHT - PADDING / 2 + 22)
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to render PNG.'))
    }, 'image/png')
  })
}
