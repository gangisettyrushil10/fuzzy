// Pure, dependency-free helpers for the Obsidian notes sync feature. Kept in
// `shared` so both the main-process service (filename resolution) and the
// renderer ("send to Obsidian" block formatting) use one implementation, and so
// they're trivially unit-testable without Electron/DB.

// Path separators + Windows-reserved chars. We deliberately keep spaces,
// hyphens, and normal punctuation so vault files read like their titles
// (e.g. "Attention Is All You Need.md"). assertInsideDir in the main service is
// the authoritative traversal guard; this is just for tidy, valid filenames.
const ILLEGAL_FILENAME_RE = /[\\/:*?"<>|]/g

// Turn a document title into a safe, human-readable `.md` basename (without the
// extension). Strips path separators / reserved chars, collapses whitespace, and
// never returns an empty string.
export function slugifyNoteTitle(title: string): string {
  const cleaned = (title ?? '').replace(ILLEGAL_FILENAME_RE, '').replace(/\s+/g, ' ')
  const trimmed = cleaned.replace(/^[.\s]+|[.\s]+$/g, '')
  return (trimmed || 'Untitled').slice(0, 120)
}

// Pick a note filename (`<slug>.md`, then `<slug>-2.md`, …) that doesn't collide
// with names already claimed by *other* documents. We deliberately dedupe only
// against the `taken` set (paths mapped to other docs), not against files that
// merely exist on disk — an unmapped `<slug>.md` is adopted so reconnecting to a
// vault reuses the prior note (file-as-truth).
export function pickNoteFilename(slug: string, taken: Iterable<string>): string {
  const takenSet = new Set(taken)
  let rel = `${slug}.md`
  let n = 2
  while (takenSet.has(rel)) {
    rel = `${slug}-${n}.md`
    n += 1
  }
  return rel
}

function blockquote(text: string): string {
  return text
    .trim()
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
}

// Markdown block appended when the user sends a highlight to their Obsidian note.
export function buildHighlightBlock(input: {
  text: string
  note?: string | null
  pageNumber?: number | null
}): string {
  const page = typeof input.pageNumber === 'number' ? ` — p.${input.pageNumber}` : ''
  const lines = [`## Highlight${page}`, '', blockquote(input.text)]
  if (input.note && input.note.trim()) {
    lines.push('', input.note.trim())
  }
  return lines.join('\n')
}

// Markdown block appended when the user sends a saved AI tutor answer to their note.
export function buildAiNoteBlock(input: {
  text: string
  selectedText?: string | null
  pageNumber?: number | null
}): string {
  const page = typeof input.pageNumber === 'number' ? ` — p.${input.pageNumber}` : ''
  const lines = [`## Note (AI)${page}`, '']
  if (input.selectedText && input.selectedText.trim()) {
    lines.push(blockquote(input.selectedText), '')
  }
  lines.push(input.text.trim())
  return lines.join('\n')
}
