// Compute-on-demand AI summaries: a time-budgeted "digest" of a whole document
// and per-chapter "SparkNotes". Not persisted (no DB) — generated fresh and
// shown in the renderer. Mock and real return the identical shapes.

export interface DigestRequest {
  documentId: string
  targetMinutes: number
}

export interface DigestResult {
  documentId: string
  targetMinutes: number
  targetWords: number
  text: string
}

export interface ChapterSummary {
  index: number
  title: string
  // 1-based page (PDF) or section number (reflowable) to jump to.
  pageNumber: number
  summary: string
}

export interface ChapterSummariesResult {
  documentId: string
  chapters: ChapterSummary[]
}
