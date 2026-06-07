import type { PageRecord } from '@shared/types/database'
import type { FileType } from '@shared/formats'
import type {
  ChapterSummariesResult,
  ChapterSummary,
  DigestResult
} from '@shared/types/summary'

// Pure helpers for digest + chapter summaries: chapter segmentation + the
// deterministic mock. Electron/openai-free so it unit-tests in node;
// summaryService re-uses these for the real path too.

export interface Chapter {
  index: number
  title: string
  pageNumber: number
  text: string
}

const MAX_CHAPTERS = 24
const PDF_GROUP_MAX_CHARS = 2_400
const PDF_GROUP_MAX_PAGES = 6
const READING_WPM = 200 // baseline read speed for sizing the digest

export function targetWordsForMinutes(minutes: number): number {
  return Math.min(5_000, Math.max(150, Math.round(minutes * READING_WPM)))
}

function deriveTitle(text: string, fallback: string): string {
  const firstLine = (text.split('\n').find((l) => l.trim().length > 0) ?? '').trim()
  if (!firstLine) return fallback
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine
}

// Group an over-long chapter list into <= max buckets of consecutive chapters,
// merging text and keeping the first chapter's anchor.
function rebucket(chapters: Chapter[], max: number): Chapter[] {
  if (chapters.length <= max) return chapters
  const size = Math.ceil(chapters.length / max)
  const out: Chapter[] = []
  for (let i = 0; i < chapters.length; i += size) {
    const group = chapters.slice(i, i + size)
    out.push({
      index: out.length,
      title: group[0].title,
      pageNumber: group[0].pageNumber,
      text: group.map((c) => c.text).join('\n\n')
    })
  }
  return out
}

// Split a document into chapters. Reflowable: each stored section is a chapter.
// PDF: group consecutive pages by size/page caps. Both capped at MAX_CHAPTERS.
export function segmentChapters(pages: PageRecord[], fileType: FileType): Chapter[] {
  const usable = pages
    .filter((p) => (p.textContent ?? '').trim().length > 0)
    .sort((a, b) => a.pageNumber - b.pageNumber)
  if (usable.length === 0) return []

  if (fileType !== 'pdf') {
    const chapters = usable.map((p, i) => ({
      index: i,
      title: deriveTitle(p.textContent ?? '', `Section ${p.pageNumber}`),
      pageNumber: p.pageNumber,
      text: p.textContent ?? ''
    }))
    return rebucket(chapters, MAX_CHAPTERS)
  }

  const chapters: Chapter[] = []
  let buf: PageRecord[] = []
  let chars = 0
  const flush = (): void => {
    if (buf.length === 0) return
    const start = buf[0].pageNumber
    const end = buf[buf.length - 1].pageNumber
    chapters.push({
      index: chapters.length,
      title: start === end ? `Page ${start}` : `Pages ${start}–${end}`,
      pageNumber: start,
      text: buf.map((p) => p.textContent ?? '').join('\n\n')
    })
    buf = []
    chars = 0
  }
  for (const p of usable) {
    buf.push(p)
    chars += p.textContent?.length ?? 0
    if (buf.length >= PDF_GROUP_MAX_PAGES || chars >= PDF_GROUP_MAX_CHARS) flush()
  }
  flush()
  return rebucket(chapters, MAX_CHAPTERS)
}

export function buildMockDigest(
  documentId: string,
  title: string,
  sliceText: string,
  targetMinutes: number
): DigestResult {
  const targetWords = targetWordsForMinutes(targetMinutes)
  const preview = sliceText.replace(/\s+/g, ' ').trim().slice(0, 240)
  const text = [
    `${targetMinutes}-minute digest of “${title}” (~${targetWords} words).`,
    '',
    `Core idea: ${preview}…`,
    '',
    'This offline mock keeps the structure of a real digest — the opening frames the argument, the middle would carry the key supporting points in order, and the close would restate the takeaway. Add a Groq/OpenAI key in Settings → AI for a model-written digest sized to your time budget.'
  ].join('\n')
  return { documentId, targetMinutes, targetWords, text }
}

export function buildMockChapterSummaries(
  documentId: string,
  chapters: Chapter[]
): ChapterSummariesResult {
  const out: ChapterSummary[] = chapters.map((c) => {
    const preview = c.text.replace(/\s+/g, ' ').trim().slice(0, 160)
    return {
      index: c.index,
      title: c.title,
      pageNumber: c.pageNumber,
      summary: `${preview}… (mock summary — connect a model in Settings for a real chapter recap.)`
    }
  })
  return { documentId, chapters: out }
}
