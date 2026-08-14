interface RectLike {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

interface VisibleTextOptions {
  maxChars?: number
  viewportRect?: RectLike
  getRangeRects?: (range: Range, node: Text, start: number, end: number) => RectLike[]
}

const DEFAULT_MAX_CHARS = 1_200
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'SELECT'])
const TOKEN_RE = /\S+/g

function intersects(a: RectLike, b: RectLike): boolean {
  if (a.width <= 0 || a.height <= 0) return false
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function hasSkippedAncestor(node: Node, root: HTMLElement): boolean {
  let el = node.parentElement
  while (el && el !== root) {
    if (SKIP_TAGS.has(el.tagName)) return true
    if (el.getAttribute('aria-hidden') === 'true') return true
    el = el.parentElement
  }
  return false
}

function isHiddenTextNode(node: Text, root: HTMLElement): boolean {
  if (hasSkippedAncestor(node, root)) return true
  const parent = node.parentElement
  if (!parent) return true
  const style = window.getComputedStyle(parent)
  return style.display === 'none' || style.visibility === 'hidden'
}

function normalizeVisibleTokens(tokens: string[], maxChars: number): string {
  const text = tokens.join(' ').replace(/\s+/g, ' ').trim()
  if (text.length <= maxChars) return text

  const clipped = text.slice(0, maxChars).trim()
  const lastSpace = clipped.lastIndexOf(' ')
  return lastSpace > 240 ? clipped.slice(0, lastSpace).trim() : clipped
}

export function stripLeadingHeadingNoise(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''

  const sentenceBoundary = trimmed.search(/[.!?]["')\]]?\s+/)
  if (sentenceBoundary < 0 || sentenceBoundary > 90) return trimmed

  const lead = trimmed.slice(0, sentenceBoundary + 1).trim()
  const rest = trimmed.slice(sentenceBoundary + 1).trim()
  const leadWordCount = lead.split(/\s+/).filter(Boolean).length
  const restWordCount = rest.split(/\s+/).filter(Boolean).length

  if (restWordCount >= 35 && leadWordCount <= 7 && !/["“”]/.test(lead)) return rest
  return trimmed
}

export function visibleTextFromViewport(
  root: HTMLElement | null,
  viewport: HTMLElement | null,
  options: VisibleTextOptions = {}
): string {
  if (!root || !viewport) return ''

  const viewportRect = options.viewportRect ?? viewport.getBoundingClientRect()
  if (viewportRect.width <= 0 || viewportRect.height <= 0) return ''

  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS
  const tokens: string[] = []
  const range = document.createRange()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

  let node: Node | null
  while ((node = walker.nextNode())) {
    if (tokens.join(' ').length >= maxChars) break
    const textNode = node as Text
    const value = textNode.nodeValue ?? ''
    if (!value.trim() || isHiddenTextNode(textNode, root)) continue

    TOKEN_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = TOKEN_RE.exec(value))) {
      const start = match.index
      const end = start + match[0].length
      range.setStart(textNode, start)
      range.setEnd(textNode, end)
      const rects =
        options.getRangeRects?.(range, textNode, start, end) ?? Array.from(range.getClientRects())
      if (rects.some((rect) => intersects(rect, viewportRect))) tokens.push(match[0])
      if (tokens.join(' ').length >= maxChars) break
    }
  }

  range.detach()
  return stripLeadingHeadingNoise(normalizeVisibleTokens(tokens, maxChars))
}
