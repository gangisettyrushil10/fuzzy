// Domain types crossing the IPC boundary. Repos in main translate between
// these and SQLite rows. Dates are ISO-8601 strings (sqlite-friendly + JSON-safe).

export interface DocumentRecord {
  id: string
  title: string
  filePath: string
  fileHash: string | null
  pageCount: number | null
  fileSize: number | null
  importedAt: string
  lastOpenedAt: string | null
}

export interface PageRecord {
  id: string
  documentId: string
  pageNumber: number
  textContent: string | null
  estimatedWordCount: number
  complexityScore: number
  createdAt: string
}

export type AnnotationType = 'highlight' | 'ai_note' | 'user_note'

// Palette for highlight colors. Validated at the IPC boundary in main; the
// renderer is free to pick any of these. Adding a new color requires a
// matching CSS token; do not extend without updating the overlay styles.
export const ANNOTATION_COLORS = ['purple', 'blue', 'green', 'yellow', 'orange'] as const
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number]

export interface AnnotationPosition {
  pageNumber: number
  rectsOnPage?: Array<{ x: number; y: number; width: number; height: number }>
}

export interface AnnotationRecord {
  id: string
  documentId: string
  pageNumber: number | null
  selectedText: string
  note: string
  annotationType: AnnotationType
  color: string | null
  position: AnnotationPosition | null
  createdAt: string
  updatedAt: string | null
}

export interface CreateAnnotationInput {
  documentId: string
  pageNumber: number | null
  selectedText: string
  note: string
  annotationType: AnnotationType
  color?: string | null
  position?: AnnotationPosition | null
}

export type AiActionType =
  | 'explain'
  | 'simplify'
  | 'summarize'
  | 'define'
  | 'example'
  | 'quiz'
  | 'why_it_matters'
  | 'margin_note'

export interface AiResponseRecord {
  id: string
  documentId: string
  pageNumber: number | null
  actionType: AiActionType
  inputText: string
  contextText: string | null
  outputText: string
  model: string | null
  provider: string | null
  inputTokens: number | null
  outputTokens: number | null
  latencyMs: number | null
  costUsd: number | null
  createdAt: string
}

export interface CreateAiResponseInput {
  documentId: string
  pageNumber: number | null
  actionType: AiActionType
  inputText: string
  contextText: string | null
  outputText: string
  model: string | null
  provider: string | null
  inputTokens: number | null
  outputTokens: number | null
  latencyMs: number | null
  costUsd: number | null
}

export interface ReadingPlanSection {
  pageStart: number
  pageEnd: number
  mode: 'deep_read' | 'skim' | 'skip' | 'review'
  minutesAllocated: number
  reason: string
}

export interface ReadingPlan {
  documentId: string
  availableMinutes: number
  estimatedMinutes: number
  strategy: 'deep_read' | 'balanced' | 'skim_first' | 'exam_cram'
  sections: ReadingPlanSection[]
  keyConcepts: string[]
  suggestedCheckpoints: string[]
}

export interface ReadingSessionRecord {
  id: string
  documentId: string
  availableMinutes: number
  estimatedMinutes: number
  plan: ReadingPlan
  createdAt: string
}

export interface Flashcard {
  question: string
  answer: string
}

export interface QuizQuestion {
  question: string
  answer: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface StudyPackRecord {
  id: string
  documentId: string
  title: string
  summary: string | null
  flashcards: Flashcard[]
  quiz: QuizQuestion[]
  keyConcepts: string[]
  createdAt: string
}

// Settings — stored in the local DB. Provider keys live in encrypted blobs
// via safeStorage and are NEVER exposed back to the renderer in plaintext.
export type ProviderMode = 'mock' | 'openai'

export interface AppSettings {
  providerMode: ProviderMode
  openaiModel: string
  hasOpenaiKey: boolean
  lastActiveDocumentId: string | null
}

// Run-action contract crossing the IPC boundary.
export interface AiConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AiActionRequest {
  documentId: string
  pageNumber: number
  action: AiActionType
  selectedText: string
  // A small amount of nearby context, typically the same page's text.
  contextText: string | null
  /** Prior turns in this tutor thread (capped in main before sending to the model). */
  conversationHistory?: AiConversationTurn[]
  /** Follow-up question about the same passage; uses history when present. */
  followUpText?: string | null
}

export interface AiActionResult {
  outputText: string
  model: string
  provider: ProviderMode
  inputTokens: number | null
  outputTokens: number | null
  latencyMs: number
  // Tells the renderer when an openai-mode request silently fell back to
  // mock (e.g. missing key, decrypt failure). null on success.
  fallbackReason: 'no_api_key' | null
}

// Returned by the import flow. Tells the renderer whether this is a fresh
// import or a duplicate that was deduped by content hash.
export interface ImportResult {
  document: DocumentRecord
  deduped: boolean
}

// Renderer-side extracted page payload. Sent once per page as soon as that
// page renders so partial reading sessions still persist their text.
export interface ExtractedPagePayload {
  pageNumber: number
  textContent: string
  estimatedWordCount: number
}
