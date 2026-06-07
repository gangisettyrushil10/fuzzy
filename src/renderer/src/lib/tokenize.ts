// One canonical tokenizer shared by the pacer (word-by-word sweep), the
// complex-word detector, and the thesis in-page mapper. It splits text into an
// ordered array of word and gap (whitespace/punctuation) tokens, each carrying
// its char offsets so callers can map a token back to a position in the source
// string — and a line index so the pacer can reason about lines.
//
// Pure + DOM-free on purpose: unit-testable without jsdom.

export interface Token {
  // Position in the token array (includes gaps). Stable id for a given text.
  index: number
  // Raw substring this token covers.
  text: string
  // Char offset in the source string, inclusive start / exclusive end.
  start: number
  end: number
  // True for word tokens, false for whitespace/punctuation runs ("gaps").
  isWord: boolean
  // 0-based line the token sits on (count of '\n' before it).
  lineIndex: number
}

// A "word" is a run of letters/digits, optionally joined by a single internal
// apostrophe or hyphen (so "don't" and "well-being" stay one token). Unicode
// aware so accented text tokenizes correctly.
const WORD_RE = /[\p{L}\p{N}]+(?:[''’‐-]?[\p{L}\p{N}]+)*/gu

export function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let cursor = 0
  let line = 0
  let idx = 0

  const pushGap = (start: number, end: number): void => {
    if (end <= start) return
    const gap = text.slice(start, end)
    tokens.push({ index: idx++, text: gap, start, end, isWord: false, lineIndex: line })
    for (let i = 0; i < gap.length; i++) {
      if (gap.charCodeAt(i) === 10 /* \n */) line++
    }
  }

  WORD_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WORD_RE.exec(text)) !== null) {
    const wStart = m.index
    const wEnd = wStart + m[0].length
    pushGap(cursor, wStart)
    tokens.push({ index: idx++, text: m[0], start: wStart, end: wEnd, isWord: true, lineIndex: line })
    cursor = wEnd
  }
  pushGap(cursor, text.length)
  return tokens
}

// Just the word tokens, in order.
export function words(tokens: Token[]): Token[] {
  return tokens.filter((t) => t.isWord)
}

// Locate a quote snippet inside a longer text by WORD SEQUENCE (not raw
// substring), so whitespace/newline differences don't matter. Returns the
// matched word tokens' `index` values, in order. Anchors on the first few words
// (shrinking for resilience to a small tail mismatch), then extends greedily,
// stopping at the first word that stops matching. Empty if not found.
// Shared by the PDF highlighter (index -> rect) and the reflowable highlighter
// (index -> span class).
export function findWordSequence(haystackText: string, snippet: string): number[] {
  const query = words(tokenize(snippet)).map((t) => t.text.toLowerCase())
  if (query.length === 0) return []
  const hay = words(tokenize(haystackText))
  if (hay.length === 0) return []

  const findAnchor = (anchorLen: number): number => {
    if (anchorLen <= 0 || anchorLen > query.length) return -1
    for (let i = 0; i + anchorLen <= hay.length; i++) {
      let match = true
      for (let j = 0; j < anchorLen; j++) {
        if (hay[i + j].text.toLowerCase() !== query[j]) {
          match = false
          break
        }
      }
      if (match) return i
    }
    return -1
  }

  let start = -1
  for (const len of [8, 5, 3]) {
    start = findAnchor(Math.min(len, query.length))
    if (start >= 0) break
  }
  if (start < 0) return []

  const indices: number[] = []
  for (let k = 0; k < query.length && start + k < hay.length; k++) {
    if (hay[start + k].text.toLowerCase() !== query[k]) break
    indices.push(hay[start + k].index)
  }
  return indices
}

// Relative pacing duration for a word token (1 ≈ an average ~5-char word).
// Longer words get a little more dwell time; clamped so outliers don't stall
// the sweep. Gaps return 0 — the scheduler only paces words and can add its
// own pause when the following gap contains sentence punctuation.
export function weightForToken(t: Token): number {
  if (!t.isWord) return 0
  const w = 0.4 + t.text.length / 6
  if (w < 0.5) return 0.5
  if (w > 3) return 3
  return w
}
