// Server-side text IR for the thesis search. This is intentionally DIFFERENT
// from the renderer tokenizer (lib/tokenize): there we keep offsets + spans for
// rendering; here we want stopword-stripped terms for ranking and sentence
// chunks for quotable evidence.

// A compact English stopword list — common function words that add noise to
// lexical relevance. Not exhaustive; enough to stop "the/of/and" dominating.
export const STOPWORDS = new Set<string>([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'for', 'from',
  'had', 'has', 'have', 'he', 'her', 'his', 'i', 'in', 'into', 'is', 'it', 'its',
  'of', 'on', 'or', 'our', 'she', 'so', 'than', 'that', 'the', 'their', 'them',
  'then', 'there', 'these', 'they', 'this', 'to', 'was', 'we', 'were', 'what',
  'when', 'which', 'who', 'will', 'with', 'would', 'you', 'your', 'about',
  'also', 'can', 'could', 'do', 'does', 'how', 'if', 'may', 'more', 'most',
  'no', 'not', 'only', 'other', 'out', 'over', 'such', 'some', 'up', 'because'
])

// Lowercase, split on non-alphanumerics, drop stopwords and 1-char tokens.
// Used for both the query and chunk indexing so they share a vocabulary.
export function tokenizeForSearch(text: string): string[] {
  const out: string[] = []
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 2) continue
    if (STOPWORDS.has(raw)) continue
    out.push(raw)
  }
  return out
}

export interface TextChunk {
  // Index of this chunk within its page (for stable ids).
  index: number
  text: string
}

const MIN_CHUNK_CHARS = 40
const MAX_CHUNK_CHARS = 320

// Split page text into quotable chunks — roughly sentences, merging very short
// fragments and hard-splitting overly long ones so a citation snippet is a
// digestible quote, not a whole paragraph.
export function segmentIntoChunks(text: string): TextChunk[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  // Split after sentence-ending punctuation followed by a space.
  const sentences = normalized.match(/[^.!?]+[.!?]+(?:["')\]]+)?|\S[^.!?]*$/g) ?? [normalized]

  const chunks: string[] = []
  let buffer = ''
  const flush = (): void => {
    const t = buffer.trim()
    if (t) chunks.push(t)
    buffer = ''
  }

  for (const sentence of sentences) {
    const s = sentence.trim()
    if (!s) continue
    if (s.length > MAX_CHUNK_CHARS) {
      flush()
      // Hard-wrap a very long sentence at word boundaries.
      let rest = s
      while (rest.length > MAX_CHUNK_CHARS) {
        let cut = rest.lastIndexOf(' ', MAX_CHUNK_CHARS)
        if (cut < MIN_CHUNK_CHARS) cut = MAX_CHUNK_CHARS
        chunks.push(rest.slice(0, cut).trim())
        rest = rest.slice(cut).trim()
      }
      if (rest) buffer = rest
      continue
    }
    buffer = buffer ? `${buffer} ${s}` : s
    if (buffer.length >= MIN_CHUNK_CHARS) flush()
  }
  flush()

  return chunks.map((text, index) => ({ index, text }))
}
