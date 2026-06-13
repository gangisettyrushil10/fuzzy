// Domain types crossing the IPC boundary. Repos in main translate between
// these and SQLite rows. Dates are ISO-8601 strings (sqlite-friendly + JSON-safe).

import type { FileType } from '../formats'

export interface DocumentRecord {
  id: string
  title: string
  filePath: string
  fileHash: string | null
  /**
   * Ingested file format. Drives the renderer reader-switch and the
   * main-process extraction dispatcher. Defaults to 'pdf' for rows that
   * predate multi-format support (see the v3 DB migration).
   */
  fileType: FileType
  pageCount: number | null
  fileSize: number | null
  importedAt: string
  lastOpenedAt: string | null
  // Citation metadata (DB migration v4). Best-effort auto-extracted at import
  // (pdf.js Info / EPUB OPF) and user-editable via the Thesis Workspace. All
  // nullable — the manual editor is the primary path, auto-extract a bonus.
  author: string | null
  year: number | null
  publisher: string | null
  sourceUrl: string | null
  // Detected (or user-overridden) genre — selects the genre adapter. null until
  // classified at import (DB migration v7).
  genre: DocumentGenre | null
  // High-water mark: the furthest page the user has ever reached. Used to
  // restore position on open and as the spoiler-safe boundary (DB migration v11).
  lastReadPage: number | null
}

// Document genres recognized by the genre adapter. Drives segmentation, entity
// kind, locator format, and the prompt library per document.
export const DOCUMENT_GENRES = [
  'fiction',
  'nonfiction',
  'textbook',
  'paper',
  'news',
  'play',
  'transcript'
] as const
export type DocumentGenre = (typeof DOCUMENT_GENRES)[number]

// The user-editable / auto-extracted citation fields, as a standalone patch.
export interface DocMetadata {
  author: string | null
  year: number | null
  publisher: string | null
  sourceUrl: string | null
}

export interface PageRecord {
  id: string
  documentId: string
  pageNumber: number
  textContent: string | null
  // Sanitized rich HTML for reflowable formats; NULL for PDF / plain text (the
  // reader falls back to textContent). textContent stays the canonical string.
  htmlContent: string | null
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

// Card/question kinds and the content categories the generator can target.
// All new fields below are OPTIONAL so packs created before this feature still
// parse (kind defaults to 'qa', format to 'short_answer').
export type FlashcardKind = 'qa' | 'cloze'

export interface Flashcard {
  question: string // cloze: a sentence with the term blanked as "____"
  answer: string // cloze: the removed term(s)
  kind?: FlashcardKind
}

export type QuizFormat = 'multiple_choice' | 'short_answer' | 'true_false'

// Content categories. The first four are narrative, the next four academic, the
// last two universal. categoriesForGenre() seeds the modal's defaults per genre.
export const QUIZ_CATEGORIES = [
  'plot',
  'characters',
  'tone',
  'themes',
  'arguments',
  'evidence',
  'concepts',
  'methods',
  'vocabulary',
  'general'
] as const
export type QuizCategory = (typeof QUIZ_CATEGORIES)[number]

export const QUIZ_CATEGORY_LABELS: Record<QuizCategory, string> = {
  plot: 'Plot & events',
  characters: 'Characters',
  tone: 'Tone & style',
  themes: 'Themes',
  arguments: 'Arguments',
  evidence: 'Evidence',
  concepts: 'Concepts',
  methods: 'Methods',
  vocabulary: 'Vocabulary',
  general: 'General'
}

export interface QuizQuestion {
  question: string
  answer: string
  difficulty: 'easy' | 'medium' | 'hard'
  format?: QuizFormat // default 'short_answer'
  choices?: string[] // multiple_choice / true_false
  correctIndex?: number // index into choices for the right answer
  category?: QuizCategory
}

export type QuizDifficulty = QuizQuestion['difficulty']

// Per-generation knobs. Persisted onto the pack (options_json) and as the
// last-used defaults in StudyPackPrefs.
export interface StudyPackOptions {
  difficulties: QuizDifficulty[]
  categories: QuizCategory[]
  formats: QuizFormat[]
  quizCount: number
  flashcardCount: number
  includeCloze: boolean
  focusNote?: string
  // Inclusive 1-based page window; null = whole document.
  pageRange?: { start: number; end: number } | null
}

export const STUDY_PACK_LIMITS = {
  quizCount: { min: 3, max: 25 },
  flashcardCount: { min: 3, max: 30 }
} as const

export const DEFAULT_STUDY_PACK_OPTIONS: StudyPackOptions = {
  difficulties: ['easy', 'medium', 'hard'],
  categories: ['general'],
  formats: ['multiple_choice', 'short_answer'],
  quizCount: 8,
  flashcardCount: 10,
  includeCloze: false,
  focusNote: '',
  pageRange: null
}

// Genre-adaptive default category set. Narrative genres surface plot/characters;
// academic genres surface arguments/evidence; everything else stays universal.
export function categoriesForGenre(genre: DocumentGenre | null): QuizCategory[] {
  switch (genre) {
    case 'fiction':
    case 'play':
      return ['plot', 'characters', 'tone', 'themes']
    case 'paper':
    case 'textbook':
    case 'nonfiction':
      return ['arguments', 'evidence', 'concepts', 'methods']
    case 'news':
      return ['arguments', 'tone', 'concepts', 'vocabulary']
    case 'transcript':
      return ['tone', 'concepts', 'arguments', 'vocabulary']
    default:
      return ['general', 'concepts', 'vocabulary']
  }
}

// Clamp/validate an untrusted options patch onto defaults. Shared by main (IPC +
// before generation) and the prefs blob so a bad value can never reach the model
// or a slider. Always returns a usable StudyPackOptions.
export function normalizeStudyPackOptions(raw: unknown): StudyPackOptions {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<StudyPackOptions>
  const d = DEFAULT_STUDY_PACK_OPTIONS
  const uniq = <T>(arr: T[], allowed: readonly T[], fallback: T[]): T[] => {
    const filtered = Array.isArray(arr) ? arr.filter((x) => allowed.includes(x)) : []
    const deduped = [...new Set(filtered)]
    return deduped.length ? deduped : fallback
  }
  let pageRange: StudyPackOptions['pageRange'] = null
  if (r.pageRange && typeof r.pageRange === 'object') {
    const s = Math.round(clampNumber(r.pageRange.start, 1, 100_000, 1))
    const e = Math.round(clampNumber(r.pageRange.end, 1, 100_000, s))
    pageRange = { start: Math.min(s, e), end: Math.max(s, e) }
  }
  return {
    difficulties: uniq(
      r.difficulties as QuizDifficulty[],
      ['easy', 'medium', 'hard'] as const,
      d.difficulties
    ),
    categories: uniq(r.categories as QuizCategory[], QUIZ_CATEGORIES, d.categories),
    formats: uniq(
      r.formats as QuizFormat[],
      ['multiple_choice', 'short_answer', 'true_false'] as const,
      d.formats
    ),
    quizCount: Math.round(
      clampNumber(r.quizCount, STUDY_PACK_LIMITS.quizCount.min, STUDY_PACK_LIMITS.quizCount.max, d.quizCount)
    ),
    flashcardCount: Math.round(
      clampNumber(
        r.flashcardCount,
        STUDY_PACK_LIMITS.flashcardCount.min,
        STUDY_PACK_LIMITS.flashcardCount.max,
        d.flashcardCount
      )
    ),
    includeCloze: typeof r.includeCloze === 'boolean' ? r.includeCloze : d.includeCloze,
    focusNote: typeof r.focusNote === 'string' ? r.focusNote.slice(0, 400) : '',
    pageRange
  }
}

export interface StudyPackRecord {
  id: string
  documentId: string
  title: string
  summary: string | null
  flashcards: Flashcard[]
  quiz: QuizQuestion[]
  keyConcepts: string[]
  // The options used to generate this pack (null for legacy packs). Drives the
  // history chips ("Hard · MCQ · tone").
  options: StudyPackOptions | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// Interactive quiz attempts — one row per completed quiz run, for score history.
// ---------------------------------------------------------------------------
export interface QuizAttemptAnswer {
  questionIndex: number
  given: string // chosen option text or typed/self-graded answer
  correct: boolean
}

export interface QuizAttemptRecord {
  id: string
  studyPackId: string
  documentId: string
  score: number
  total: number
  answers: QuizAttemptAnswer[]
  startedAt: string
  completedAt: string
}

export interface QuizAttemptStats {
  attempts: number
  bestPct: number // 0..100
  lastPct: number // 0..100
}

// ---------------------------------------------------------------------------
// Spaced repetition — SM-2 lite scheduling state, one row per (pack, cardIndex).
// ---------------------------------------------------------------------------
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy'

export interface FlashcardReviewState {
  ease: number // SM-2 ease factor (>= 1.3)
  intervalDays: number
  repetitions: number
  dueAt: string // ISO; <= now means due
  lastReviewedAt: string | null
}

// A flashcard surfaced in the cross-document "due today" queue, hydrated with
// its content from the owning pack.
export interface DueCard {
  studyPackId: string
  documentId: string
  documentTitle: string
  cardIndex: number
  card: Flashcard
  dueAt: string
}

// ---------------------------------------------------------------------------
// Highlight memory — imported highlights from external reading systems,
// searchable offline and scheduled for daily resurfacing.
// ---------------------------------------------------------------------------
export const HIGHLIGHT_SOURCE_KINDS = [
  'kindle',
  'instapaper',
  'apple_books',
  'generic_csv',
  'generic_json',
  'manual'
] as const
export type HighlightSourceKind = (typeof HIGHLIGHT_SOURCE_KINDS)[number]

export const HIGHLIGHT_CONTENT_KINDS = [
  'book',
  'article',
  'newsletter',
  'rss',
  'pdf',
  'epub',
  'web',
  'video',
  'thread',
  'other'
] as const
export type HighlightContentKind = (typeof HIGHLIGHT_CONTENT_KINDS)[number]

export type HighlightExportTarget =
  | 'notion'
  | 'obsidian'
  | 'evernote'
  | 'roam'
  | 'logseq'
  | 'markdown'
  | 'csv'
  | 'json'

export interface HighlightRecord {
  id: string
  sourceKind: HighlightSourceKind
  contentKind: HighlightContentKind
  sourceLabel: string
  sourceTitle: string
  sourceAuthor: string | null
  sourceUrl: string | null
  sourceLocation: string | null
  externalId: string | null
  text: string
  note: string
  tags: string[]
  isFavorite: boolean
  metadata: Record<string, string>
  highlightedAt: string
  createdAt: string
  updatedAt: string
  review: FlashcardReviewState
}

export interface CreateHighlightInput {
  sourceKind: HighlightSourceKind
  contentKind?: HighlightContentKind
  sourceLabel?: string
  sourceTitle: string
  sourceAuthor?: string | null
  sourceUrl?: string | null
  sourceLocation?: string | null
  externalId?: string | null
  text: string
  note?: string
  tags?: string[]
  isFavorite?: boolean
  metadata?: Record<string, string>
  highlightedAt?: string
}

export interface UpdateHighlightInput {
  sourceTitle?: string
  sourceAuthor?: string | null
  sourceUrl?: string | null
  sourceLocation?: string | null
  text?: string
  note?: string
  tags?: string[]
  isFavorite?: boolean
}

export interface HighlightSearchInput {
  query?: string
  tags?: string[]
  favoritesOnly?: boolean
  dueOnly?: boolean
  sourceKinds?: HighlightSourceKind[]
  limit?: number
}

export interface HighlightImportResult {
  sourceKind: HighlightSourceKind
  sourceLabel: string
  importedCount: number
  dedupedCount: number
}

export interface HighlightStats {
  total: number
  dueCount: number
  favoriteCount: number
  sourceCount: number
  topTags: string[]
}

// ---------------------------------------------------------------------------
// Study pack preferences — last-used generation options + export/SR settings,
// persisted as one JSON blob under `studyPack.prefs` (mirrors reader.prefs).
// ---------------------------------------------------------------------------
export type StudyExportFormat = 'quizlet' | 'anki' | 'csv' | 'markdown'

export interface StudyPackPrefs {
  lastOptions: StudyPackOptions
  defaultExportFormat: StudyExportFormat
  spacedRepetitionEnabled: boolean
}

export const DEFAULT_STUDY_PACK_PREFS: StudyPackPrefs = {
  lastOptions: DEFAULT_STUDY_PACK_OPTIONS,
  defaultExportFormat: 'quizlet',
  spacedRepetitionEnabled: true
}

export function normalizeStudyPackPrefs(raw: unknown): StudyPackPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<StudyPackPrefs>
  const d = DEFAULT_STUDY_PACK_PREFS
  return {
    lastOptions: normalizeStudyPackOptions(r.lastOptions),
    defaultExportFormat: oneOf(
      r.defaultExportFormat,
      ['quizlet', 'anki', 'csv', 'markdown'] as const,
      d.defaultExportFormat
    ),
    spacedRepetitionEnabled:
      typeof r.spacedRepetitionEnabled === 'boolean'
        ? r.spacedRepetitionEnabled
        : d.spacedRepetitionEnabled
  }
}

// Settings — stored in the local DB. Provider keys live in encrypted blobs
// via safeStorage and are NEVER exposed back to the renderer in plaintext.
export type ProviderMode = 'mock' | 'openai'

export interface AppSettings {
  providerMode: ProviderMode
  openaiModel: string
  hasOpenaiKey: boolean
  // Optional OpenAI-compatible base URL (Groq / OpenRouter / Ollama). null = OpenAI.
  openaiBaseUrl: string | null
  lastActiveDocumentId: string | null
}

// ---------------------------------------------------------------------------
// Reader preferences — typography + reading aids. Persisted as a single JSON
// blob under the `reader.prefs` KV key (one read, one write — no per-key IPC
// round-trips). normalizeReaderPrefs() is the single clamp/validate path,
// shared by main (before save) and renderer (after load) so a bad/legacy value
// can never crash a slider.
// ---------------------------------------------------------------------------
export type ReaderContentWidth = 'narrow' | 'normal' | 'wide'
export type ComplexitySensitivity = 'off' | 'subtle' | 'aggressive'
export type CitationFormat = 'mla' | 'apa' | 'chicago' | 'harvard'

export const CITATION_FORMAT_LABELS: Record<CitationFormat, string> = {
  mla: 'MLA',
  apa: 'APA',
  chicago: 'Chicago',
  harvard: 'Harvard'
}

// Reader typography knobs. The shared layer only owns the allow-lists (so a
// persisted value is validated before it touches the CSS layer); the renderer
// owns the actual font stacks (theme/readerFonts.ts) and reading-surface
// palettes (theme/readingThemes.ts) — same split as THEME_IDS ↔ themes.ts.
export const READER_FONT_IDS = [
  'serif-book',
  'sans-clean',
  'dyslexic',
  'mono',
  'system-serif',
  'system-sans'
] as const
export type ReaderFontId = (typeof READER_FONT_IDS)[number]

export const READER_FONT_LABELS: Record<ReaderFontId, string> = {
  'serif-book': 'Literata',
  'sans-clean': 'Inter',
  dyslexic: 'OpenDyslexic',
  mono: 'Monospace',
  'system-serif': 'System serif',
  'system-sans': 'System sans'
}

// Reading-surface (page) color schemes, independent of the whole-app theme.
// `match-app` tracks the app theme's surface/fg at the CSS-var level; `custom`
// uses customPageBg/Fg; the rest are fixed e-reader palettes.
export const READING_THEME_IDS = [
  'match-app',
  'paper',
  'sepia',
  'night',
  'black',
  'custom'
] as const
export type ReadingThemeId = (typeof READING_THEME_IDS)[number]

export type ReaderTextAlign = 'left' | 'justify'

export interface ReaderPrefs {
  fontSize: number // px
  lineHeight: number
  contentWidth: ReaderContentWidth
  targetWpm: number
  focusMode: boolean
  complexitySensitivity: ComplexitySensitivity
  animations: boolean
  citationFormat: CitationFormat
  // Typography. font family/size do NOT affect baked PDF glyphs — only the
  // reflowable reader's text and the PDF reading surface / color filter.
  fontFamily: ReaderFontId
  textAlign: ReaderTextAlign
  paragraphSpacing: number // em of vertical gap between block elements
  letterSpacing: number // em
  // Reading surface (page colors), independent of the whole-app theme.
  readingTheme: ReadingThemeId
  customPageBg: string | null // 6-digit hex; only meaningful when readingTheme === 'custom'
  customPageFg: string | null
}

export const READER_PREF_LIMITS = {
  fontSize: { min: 14, max: 32 },
  lineHeight: { min: 1.3, max: 2.2 },
  targetWpm: { min: 100, max: 900 },
  paragraphSpacing: { min: 0, max: 2 },
  letterSpacing: { min: -0.05, max: 0.2 }
} as const

export const DEFAULT_READER_PREFS: ReaderPrefs = {
  fontSize: 17,
  lineHeight: 1.7,
  contentWidth: 'normal',
  targetWpm: 300,
  focusMode: false,
  complexitySensitivity: 'subtle',
  animations: true,
  citationFormat: 'mla',
  fontFamily: 'serif-book',
  textAlign: 'left',
  paragraphSpacing: 0.8,
  letterSpacing: 0,
  readingTheme: 'match-app',
  customPageBg: null,
  customPageFg: null
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, n))
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

// Merge an untrusted partial onto defaults, clamping every field. Accepts any
// shape (parsed JSON, partial patch) and always returns a valid ReaderPrefs.
export function normalizeReaderPrefs(raw: unknown): ReaderPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReaderPrefs>
  const d = DEFAULT_READER_PREFS
  return {
    fontSize: clampNumber(r.fontSize, READER_PREF_LIMITS.fontSize.min, READER_PREF_LIMITS.fontSize.max, d.fontSize),
    lineHeight: clampNumber(r.lineHeight, READER_PREF_LIMITS.lineHeight.min, READER_PREF_LIMITS.lineHeight.max, d.lineHeight),
    contentWidth: oneOf(r.contentWidth, ['narrow', 'normal', 'wide'] as const, d.contentWidth),
    targetWpm: Math.round(clampNumber(r.targetWpm, READER_PREF_LIMITS.targetWpm.min, READER_PREF_LIMITS.targetWpm.max, d.targetWpm)),
    focusMode: typeof r.focusMode === 'boolean' ? r.focusMode : d.focusMode,
    complexitySensitivity: oneOf(r.complexitySensitivity, ['off', 'subtle', 'aggressive'] as const, d.complexitySensitivity),
    animations: typeof r.animations === 'boolean' ? r.animations : d.animations,
    citationFormat: oneOf(r.citationFormat, ['mla', 'apa', 'chicago', 'harvard'] as const, d.citationFormat),
    fontFamily: oneOf(r.fontFamily, READER_FONT_IDS, d.fontFamily),
    textAlign: oneOf(r.textAlign, ['left', 'justify'] as const, d.textAlign),
    paragraphSpacing: clampNumber(r.paragraphSpacing, READER_PREF_LIMITS.paragraphSpacing.min, READER_PREF_LIMITS.paragraphSpacing.max, d.paragraphSpacing),
    letterSpacing: clampNumber(r.letterSpacing, READER_PREF_LIMITS.letterSpacing.min, READER_PREF_LIMITS.letterSpacing.max, d.letterSpacing),
    readingTheme: oneOf(r.readingTheme, READING_THEME_IDS, d.readingTheme),
    customPageBg: isHexColor(r.customPageBg) ? r.customPageBg.trim().toLowerCase() : null,
    customPageFg: isHexColor(r.customPageFg) ? r.customPageFg.trim().toLowerCase() : null
  }
}

// ---------------------------------------------------------------------------
// Appearance — whole-app theming. Persisted as one JSON blob under the
// `appearance.prefs` KV key (mirrors reader.prefs). The renderer owns the
// actual color palettes (see renderer/src/theme); shared only holds the id
// allow-lists so a saved value is validated before it ever reaches the
// CSS-variable layer. normalizeAppearancePrefs is the single validate path,
// shared by main (before save) and renderer (after load).
// ---------------------------------------------------------------------------

// Built-in theme ids. `auto` is special: it resolves to a light or dark theme
// at apply time based on the OS color-scheme. Keep in lockstep with the THEMES
// registry in renderer/src/theme/themes.ts.
export const THEME_IDS = [
  'auto',
  'midnight',
  'obsidian',
  'dim',
  'nord',
  'dracula',
  'gruvbox',
  'solarized-dark',
  'high-contrast',
  'daylight',
  'paper',
  'solarized-light'
] as const
export type ThemeId = (typeof THEME_IDS)[number]

// Accent presets. `theme` keeps the active theme's own accent; `custom` uses
// the user-picked `customAccent` hex. Keep in lockstep with ACCENT_PRESETS in
// renderer/src/theme/accents.ts.
export const ACCENT_IDS = [
  'theme',
  'orange',
  'purple',
  'blue',
  'teal',
  'green',
  'amber',
  'rose',
  'crimson',
  'mono',
  'custom'
] as const
export type AccentId = (typeof ACCENT_IDS)[number]

export interface AppearancePrefs {
  themeId: ThemeId
  accentId: AccentId
  // 6-digit hex (e.g. #7c5cff). Only meaningful when accentId === 'custom';
  // retained across accent switches so toggling back restores the last value.
  customAccent: string | null
}

export const DEFAULT_APPEARANCE_PREFS: AppearancePrefs = {
  themeId: 'midnight',
  accentId: 'theme',
  customAccent: null
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

// True for a normalized 6-digit hex string. Shorthand (#abc) and named colors
// are intentionally rejected — the color <input> only ever emits #rrggbb.
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value.trim())
}

// Merge an untrusted partial onto defaults, validating every field. Accepts any
// shape (parsed JSON, partial patch) and always returns a valid AppearancePrefs.
export function normalizeAppearancePrefs(raw: unknown): AppearancePrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppearancePrefs>
  const d = DEFAULT_APPEARANCE_PREFS
  return {
    themeId: oneOf(r.themeId, THEME_IDS, d.themeId),
    accentId: oneOf(r.accentId, ACCENT_IDS, d.accentId),
    customAccent: isHexColor(r.customAccent) ? r.customAccent.trim().toLowerCase() : null
  }
}

// ---------------------------------------------------------------------------
// Thesis Workspace — real lexical search over the library's page text, with
// citations. AI "reasoning" is mocked; retrieval/ranking is real.
// ---------------------------------------------------------------------------
export type ThesisScope = 'library' | 'active'

export interface ThesisSearchRequest {
  thesis: string
  scope: ThesisScope
  // Required when scope === 'active'.
  activeDocumentId?: string | null
  limit?: number
}

export interface RankedPassage {
  // Stable id: `${documentId}:${pageNumber}:${chunkIndex}`.
  id: string
  documentId: string
  documentTitle: string
  pageNumber: number
  snippet: string
  // 0..1 normalized relevance (1 = best match in this result set).
  score: number
  // All four citation formats, precomputed from the doc's metadata + page.
  citations: Record<CitationFormat, string>
}

export interface ThesisSearchResult {
  query: string
  scope: ThesisScope
  // How many documents were in the searched index (for the "indexing N…" UX).
  indexedDocumentCount: number
  passages: RankedPassage[]
}

// ---------------------------------------------------------------------------
// Cross-document synthesis — a structured, cited argument built from passages
// gathered by the thesis search. Same shape from the mock and the real model.
// ---------------------------------------------------------------------------
export interface SynthesisEvidence {
  quote: string
  documentId: string
  documentTitle: string
  pageNumber: number
  citations: Record<CitationFormat, string>
}

export interface SynthesisSubClaim {
  claim: string
  evidence: SynthesisEvidence[]
}

export interface SynthesisResult {
  thesis: string
  subClaims: SynthesisSubClaim[]
  tensions: string[]
  summary: string
  // How many library passages were considered (for the "analyzed N" line).
  consideredPassageCount: number
}

// 'support' assembles the case FOR the thesis; 'counter' surfaces the strongest
// opposing case (counter-arguments / rebuttals) from the same library passages.
export type SynthesisMode = 'support' | 'counter'

export interface SynthesisRequest {
  thesis: string
  scope: ThesisScope
  activeDocumentId?: string | null
  mode?: SynthesisMode
}

// ---------------------------------------------------------------------------
// Projects — durable research workspaces: a thesis + collected evidence quotes
// + free-form notes + saved syntheses. Replaces the session-only evidence shelf.
// ---------------------------------------------------------------------------
export interface ProjectRecord {
  id: string
  title: string
  thesis: string
  createdAt: string
  updatedAt: string
}

export interface ProjectEvidenceRecord {
  id: string
  projectId: string
  documentId: string
  documentTitle: string
  pageNumber: number
  snippet: string
  citations: Record<CitationFormat, string>
  score: number
  createdAt: string
}

export interface ProjectNoteRecord {
  id: string
  projectId: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface ProjectSynthesisRecord {
  id: string
  projectId: string
  thesis: string
  result: SynthesisResult
  createdAt: string
}

// A project plus all its child records — returned when opening a project.
export interface ProjectDetail {
  project: ProjectRecord
  evidence: ProjectEvidenceRecord[]
  notes: ProjectNoteRecord[]
  syntheses: ProjectSynthesisRecord[]
}

export type ExportFormat = 'markdown' | 'html'

// ---------------------------------------------------------------------------
// Focus Sessions + Reading Stats — timed, distraction-free reading with
// persisted minutes / words / WPM and streaks. The attention wedge.
// ---------------------------------------------------------------------------
export type FocusGoalType = 'none' | 'time' | 'words'

export interface FocusSessionRecord {
  id: string
  documentId: string
  startedAt: string
  endedAt: string | null
  elapsedSeconds: number
  wordsRead: number
  wpm: number | null
  pageStart: number | null
  pageEnd: number | null
  goalType: FocusGoalType
  goalTarget: number | null
  createdAt: string
}

export interface StartFocusSessionInput {
  documentId: string
  pageStart: number | null
  goalType: FocusGoalType
  goalTarget: number | null
}

export interface FocusSessionProgress {
  elapsedSeconds: number
  wordsRead: number
  pageEnd: number | null
}

export interface ReadingStats {
  todayMinutes: number
  streakDays: number
  totalMinutes: number
  totalWords: number
  avgWpm: number
  sessionCount: number
  last7Days: Array<{ date: string; minutes: number }>
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
  // Sanitized rich HTML (reflowable extractors set this; PDF/plain text omit it).
  htmlContent?: string | null
}

// Result of main-process extraction for ANY format. For paginated formats
// (PDF) `pages` are real pages; for reflowable formats (epub/docx/…) each
// entry is an ordered section/chapter with a 1-based `pageNumber` index.
// This is the shared contract every per-format extractor implements.
export interface ExtractedDocument {
  pageCount: number
  pages: ExtractedPagePayload[]
}

// ---------------------------------------------------------------------------
// Entity/structure index — durable structured data extracted per document at
// import. `kind` is the genre discriminator (character today; claim/citation/
// speaker/concept later). Retrieval + relationship features query this instead
// of re-scanning page text.
// ---------------------------------------------------------------------------
export type EntityKind = 'character' | 'claim' | 'citation' | 'speaker' | 'concept'

export interface EntityMention {
  pageNumber: number
  surfaceForm: string
  count: number
}

// Pure-extractor output (no DB ids yet). Persisted by entityRepository.
export interface ExtractedEntity {
  name: string
  normalizedName: string
  aliases: string[]
  mentionCount: number
  firstPage: number | null
  salience: number // 0..1
  mentions: EntityMention[]
}

export interface EntityRecord {
  id: string
  documentId: string
  kind: EntityKind
  name: string
  normalizedName: string
  aliases: string[]
  mentionCount: number
  firstPage: number | null
  salience: number
  source: 'local' | 'llm'
  createdAt: string
}

// ---------------------------------------------------------------------------
// Evidence search — inferential, doc-scoped claim/evidence queries ("find
// evidence that two characters are in love"). The engine: decompose → retrieve
// candidates (local) → verify with an LLM-judge that must quote a verbatim span
// → synthesize. Citations are re-attached deterministically from real passages.
// ---------------------------------------------------------------------------
export interface EvidenceSearchRequest {
  query: string
  documentId: string
  // Optional explicit entity ids (e.g. from an @-mention) to skip name resolution.
  entityIds?: string[] | null
  limit?: number
}

export interface EvidenceDecomposition {
  entities: string[]
  relation: string
  signalVocabulary: string[]
}

export type EvidenceStrength = 'strong' | 'moderate' | 'weak'

// Structural superset of RankedPassage (so click-to-jump works unchanged) plus
// the judge's verdict fields.
export interface EvidenceItem {
  id: string
  documentId: string
  documentTitle: string
  pageNumber: number
  snippet: string
  score: number
  citations: Record<CitationFormat, string>
  strength: EvidenceStrength
  rationale: string
}

export interface EvidenceSubClaim {
  claim: string
  evidence: EvidenceItem[]
}

export interface EvidenceSearchResult {
  query: string
  documentId: string
  decomposition: EvidenceDecomposition
  claim: string
  subClaims: EvidenceSubClaim[]
  summary: string
  consideredCandidateCount: number
  fallbackReason: 'no_api_key' | null
}

// ---------------------------------------------------------------------------
// Tone search — "Ctrl-F for mood". Ranks passages by how strongly their diction
// evokes a tone, entirely locally (a curated affect lexicon, $0 API).
// ---------------------------------------------------------------------------
export interface ToneSearchRequest {
  documentId: string
  tone: string
  limit?: number
}

// RankedPassage + the matched tone words (for highlighting/explanation).
export interface ToneMatch extends RankedPassage {
  matchedWords: string[]
}

export interface ToneSearchResult {
  tone: string
  documentId: string
  passages: ToneMatch[]
}

// ---------------------------------------------------------------------------
// Ask the book — RAG chat scoped to one document, every answer citation-anchored
// and jump-able. spoilerSafe restricts retrieval to pages <= currentPage.
// ---------------------------------------------------------------------------
export interface AskRequest {
  documentId: string
  question: string
  spoilerSafe?: boolean
  currentPage?: number | null
  limit?: number
  // Opt-in: let the model search the live web to supplement the document.
  // Mutually exclusive with spoilerSafe (the web doesn't respect your reading
  // position). Requires a real provider/key; ignored in mock mode.
  webSearch?: boolean
}

// A live-web citation returned when webSearch was used.
export interface WebSource {
  title: string
  url: string
}

// How the answer was produced — surfaced in the UI so summaries/web answers are
// distinguishable from plain grounded Q&A.
export type AskMode = 'qa' | 'summary'

export interface AskResult {
  question: string
  answer: string
  sources: RankedPassage[]
  spoilerSafe: boolean
  fallbackReason: 'no_api_key' | null
  // Present (possibly empty) when the answer drew on a live web search.
  usedWeb?: boolean
  webSources?: WebSource[]
  // Set when web search was requested but couldn't run (model unavailable, etc.)
  // — the answer falls back to the document and we tell the user why.
  webError?: string | null
  // 'summary' when the question was a "summarize this chapter" intent.
  mode?: AskMode
  // For a chapter summary, the page/chapter that was summarized.
  summaryPage?: number | null
}

// ---------------------------------------------------------------------------
// Essay Workspace — "cursor for writing essays". A thesis becomes an
// evidence-grounded outline (built by reusing the synthesis engine, so body
// sections carry real cited passages), each section drafts into a paragraph, and
// the whole thing compiles to a Markdown draft. Persisted like Projects.
// ---------------------------------------------------------------------------
export type EssaySectionKind = 'introduction' | 'body' | 'counterargument' | 'conclusion'

export interface EssaySection {
  id: string
  kind: EssaySectionKind
  heading: string
  // The section's controlling idea / topic sentence.
  point: string
  // Real, cited passages supporting the point (reuses synthesis evidence).
  evidence: SynthesisEvidence[]
  // The drafted paragraph, once generated.
  draft?: string
}

export interface EssayOutline {
  thesis: string
  sections: EssaySection[]
}

export interface EssayRecord {
  id: string
  title: string
  thesis: string
  scope: ThesisScope
  outline: EssayOutline | null
  draftMd: string
  createdAt: string
  updatedAt: string
}

export interface EssayOutlineRequest {
  thesis: string
  scope: ThesisScope
  activeDocumentId?: string | null
}

export interface EssayDraftRequest {
  thesis: string
  section: EssaySection
  citationFormat: CitationFormat
}

// ---------------------------------------------------------------------------
// Argument Map — "reverse synthesis": extract a document's OWN thesis, main
// claims, the evidence supporting each (verbatim-validated, cited), and notable
// rhetorical moves. The reading-analysis counterpart to the Essay Workspace —
// great for rhetorical analysis (AP Lang) and critiquing non-fiction.
// ---------------------------------------------------------------------------
export type ClaimAssessment = 'well-supported' | 'asserted' | 'contested'

export interface ArgumentClaim {
  id: string
  claim: string
  support: SynthesisEvidence[]
  assessment: ClaimAssessment
  note: string
}

export interface ArgumentMapRequest {
  documentId: string
}

export interface ArgumentMapResult {
  documentId: string
  thesis: string
  claims: ArgumentClaim[]
  rhetoric: string[]
  summary: string
  fallbackReason: 'no_api_key' | null
}

// ---------------------------------------------------------------------------
// Key Terms Glossary — extract a document's defined terms with a plain-English
// definition and a verbatim source quote (located to a real page + cited, so it
// jumps back). The textbook/study companion; on-demand, not persisted.
// ---------------------------------------------------------------------------
export interface GlossaryTerm {
  term: string
  definition: string // plain-English gloss (may be paraphrased)
  sourceQuote: string // verbatim span from the document supporting it
  pageNumber: number
  citations: Record<CitationFormat, string>
}

export interface GlossaryResult {
  documentId: string
  terms: GlossaryTerm[]
  fallbackReason: 'no_api_key' | null
}
