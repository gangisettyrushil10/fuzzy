// Word-span layer for the RICH (HTML) reflowable reader, the DOM analogue of
// TokenizedText (which only handles a plain string). After sanitized HTML is
// injected, we walk its text nodes and wrap each WORD in a
// <span data-token-index> so the pacer / complex-word / thesis aids can
// decorate words imperatively — exactly the same data-token-index convention
// the plain path uses (the FULL tokenize() array index, gaps included).
//
// Two invariants make this safe:
//  - Whitespace stays as bare text nodes; only word characters go inside spans,
//    so getSelection().toString() round-trips (the TokenizedText invariant).
//  - The source string is the text nodes joined with '\n' separators, so a word
//    can NEVER span two nodes — every word token maps cleanly to one node. The
//    pacer/complexity/thesis are then fed this SAME string, so their token
//    indices line up with the data-token-index attributes 1:1.

import { tokenize } from './tokenize'

// Never wrap inside these (code keeps its literal whitespace; the rest have no
// readable prose). Their text nodes are left untouched.
const SKIP_TAGS = new Set(['PRE', 'CODE', 'SCRIPT', 'STYLE', 'TEXTAREA'])

function hasSkippedAncestor(node: Node, root: HTMLElement): boolean {
  let p = node.parentElement
  while (p && p !== root) {
    if (SKIP_TAGS.has(p.tagName)) return true
    p = p.parentElement
  }
  return false
}

// Wrap every word in `container` in a data-token-index span and return both the
// reconstructed source string and an index→span map. Mutates the container.
export function wrapWords(
  container: HTMLElement,
  spansByIndex: Map<number, HTMLElement[]>
): string {
  const doc = container.ownerDocument
  const textNodes: Text[] = []
  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const t = node as Text
    if (!t.nodeValue || !t.nodeValue.trim()) continue
    if (hasSkippedAncestor(t, container)) continue
    textNodes.push(t)
  }
  if (textNodes.length === 0) return ''

  // Build the source string with '\n' separators between nodes so words never
  // cross node boundaries. ranges[k] is node k's [start,end) within the string.
  let source = ''
  const ranges: Array<{ node: Text; start: number; end: number }> = []
  textNodes.forEach((t, i) => {
    if (i > 0) source += '\n'
    const start = source.length
    source += t.nodeValue as string
    ranges.push({ node: t, start, end: source.length })
  })

  const tokens = tokenize(source)
  let ti = 0
  for (const r of ranges) {
    // Advance to the first token at/after this node's start.
    while (ti < tokens.length && tokens[ti].start < r.start) ti++
    const frag = doc.createDocumentFragment()
    let cursor = r.start
    let tj = ti
    for (; tj < tokens.length && tokens[tj].start < r.end; tj++) {
      const tok = tokens[tj]
      if (!tok.isWord) continue
      if (tok.start > cursor) frag.appendChild(doc.createTextNode(source.slice(cursor, tok.start)))
      const span = doc.createElement('span')
      span.setAttribute('data-token-index', String(tok.index))
      span.className = 'fz-word'
      span.textContent = tok.text
      frag.appendChild(span)
      const list = spansByIndex.get(tok.index)
      if (list) list.push(span)
      else spansByIndex.set(tok.index, [span])
      cursor = tok.end
    }
    if (cursor < r.end) frag.appendChild(doc.createTextNode(source.slice(cursor, r.end)))
    r.node.parentNode?.replaceChild(frag, r.node)
  }
  return source
}

// Imperative controller over a wrapped container. ReflowableReader builds one
// per rendered section and drives it from effects (active word, complex flags,
// thesis flash) — mirroring what TokenizedText does declaratively for plain text.
export class WordLayer {
  readonly source: string
  private spansByIndex = new Map<number, HTMLElement[]>()
  private activeIndex: number | null = null
  private flaggedApplied = new Set<number>()

  constructor(container: HTMLElement) {
    this.source = wrapWords(container, this.spansByIndex)
  }

  private spans(index: number): HTMLElement[] {
    return this.spansByIndex.get(index) ?? []
  }

  // Move the pacer's active-word glow; gently scroll it into view if off-screen.
  setActive(index: number | null): void {
    if (index === this.activeIndex) return
    if (this.activeIndex != null) {
      for (const el of this.spans(this.activeIndex)) el.classList.remove('fz-pace-active')
    }
    this.activeIndex = index
    if (index != null) {
      const els = this.spans(index)
      for (const el of els) el.classList.add('fz-pace-active')
      els[0]?.scrollIntoView({ block: 'nearest' })
    }
  }

  // Apply the complex-word underline + click-to-define to exactly `indices`,
  // clearing any previously-flagged words that dropped out.
  setFlagged(indices: Set<number>, onWordClick: (word: string, rect: DOMRect) => void): void {
    for (const idx of this.flaggedApplied) {
      if (indices.has(idx)) continue
      for (const el of this.spans(idx)) {
        el.classList.remove('fz-complex-word')
        el.onclick = null
      }
    }
    this.flaggedApplied = new Set()
    for (const idx of indices) {
      for (const el of this.spans(idx)) {
        el.classList.add('fz-complex-word')
        el.onclick = (e): void => {
          e.stopPropagation()
          onWordClick(el.textContent ?? '', el.getBoundingClientRect())
        }
      }
      this.flaggedApplied.add(idx)
    }
  }

  // Thesis "go to source": flash the matched words once and scroll to them.
  flash(indices: number[], durationMs = 1800): void {
    const els: HTMLElement[] = []
    for (const idx of indices) els.push(...this.spans(idx))
    if (els.length === 0) return
    for (const el of els) el.classList.add('fz-evidence-flash')
    els[0]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    window.setTimeout(() => {
      for (const el of els) el.classList.remove('fz-evidence-flash')
    }, durationMs)
  }
}
