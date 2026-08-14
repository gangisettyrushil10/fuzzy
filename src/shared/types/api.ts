// Typed bridge surface exposed from preload to renderer as `window.fuzzy`.
// Each slice extends this interface as new IPC channels come online.

import type {
  AiActionRequest,
  AiActionResult,
  AiResponseRecord,
  AnnotationRecord,
  AppearancePrefs,
  AppSettings,
  CreateAnnotationInput,
  DocMetadata,
  DocumentRecord,
  ExportFormat,
  ExtractedPagePayload,
  FocusSessionProgress,
  FocusSessionRecord,
  ImportResult,
  ReadingStats,
  StartFocusSessionInput,
  PageRecord,
  ProjectDetail,
  ProjectEvidenceRecord,
  ProjectNoteRecord,
  ProjectRecord,
  ProjectSynthesisRecord,
  ProviderMode,
  RankedPassage,
  ReaderPrefs,
  ReadingSessionRecord,
  DueCard,
  HighlightExportTarget,
  HighlightImportResult,
  HighlightRecord,
  HighlightSearchInput,
  HighlightStats,
  FlashcardReviewState,
  QuizAttemptRecord,
  QuizAttemptStats,
  ReviewGrade,
  StudyExportFormat,
  StudyPackOptions,
  StudyPackPrefs,
  StudyPackRecord,
  SynthesisRequest,
  SynthesisResult,
  ThesisSearchRequest,
  ThesisSearchResult
} from './database'
import type { CitationFormat } from './database'
import type { ChapterSummariesResult, DigestResult } from './summary'
import type { EntityRecord, EvidenceSearchRequest, EvidenceSearchResult } from './database'
import type { AskRequest, AskResult, ToneSearchRequest, ToneSearchResult } from './database'
import type { ArgumentMapResult, GlossaryResult } from './database'
import type {
  EssayDraftRequest,
  EssayOutline,
  EssayOutlineRequest,
  EssayRecord,
  ThesisScope
} from './database'

export type AmbientMood =
  | 'love'
  | 'sadness'
  | 'joy'
  | 'mystery'
  | 'tension'
  | 'calm'
  | 'awe'
  | 'fear'
  | 'anger'
  | 'grief'
  | 'hope'
  | 'wonder'
  | 'nostalgia'
  | 'neutral'

export type AmbientGenre =
  | 'fantasy'
  | 'mystery'
  | 'thriller'
  | 'romance'
  | 'sci-fi'
  | 'adventure'
  | 'literary'
  | 'academic'
  | 'unknown'

export type AmbientContentType = 'fiction' | 'non-fiction'

export type AmbientMotion = 'still' | 'drift' | 'wave' | 'mist' | 'pulse' | 'shimmer' | 'embers'

export interface AmbientClassification {
  mood: AmbientMood
  secondaryMood: AmbientMood | null
  genre: AmbientGenre
  type: AmbientContentType
  intensity: number
  sceneTags: string[]
  paletteHints: string[]
  motion: AmbientMotion
}

// Spotify Ambient Companion maps the visible passage's Moodlight classification
// to a track, then controls the installed Spotify app. Fuzzy never streams audio.
export type SpotifyPlaybackMode = 'suggest' | 'auto'

export interface SpotifyStatus {
  /** A Client ID has been saved (does not imply a completed login). */
  configured: boolean
  /** Logged in with a valid (or refreshable) token. */
  connected: boolean
  playbackMode: SpotifyPlaybackMode
  genrePreferences: string[]
}

export type SpotifyConnectResult =
  | { ok: true; status: SpotifyStatus }
  | { ok: false; error: string; status: SpotifyStatus }

export interface SpotifySuggestion {
  lane: string
  query: string
  querySource: 'embedding' | 'openai' | 'fallback'
  trackId: string | null
  uri: string | null
  name: string | null
  description: string | null
  imageUrl: string | null
  externalUrl: string | null
  artistName: string | null
}

export interface SpotifySuggestionOptions {
  excludeUris?: string[]
  passageExcerpt?: string
  documentId?: string
  pageNumber?: number
}

export interface SpotifyPlaybackSnapshot {
  uri: string
  name: string | null
  artistName: string | null
  imageUrl: string | null
  externalUrl: string | null
  progressMs: number
}

export type SpotifyPlaybackResult =
  | {
      ok: true
      started: true
      openedExternal: false
      previous: SpotifyPlaybackSnapshot | null
    }
  | {
      ok: false
      started: false
      openedExternal: false
      reason:
        | 'invalid-suggestion'
        | 'unsupported-platform'
        | 'spotify-app-unavailable'
        | 'automation-denied'
        | 'playback-unavailable'
      message: string
    }

export interface SpotifyRestoreResult {
  ok: boolean
  message?: string
}

export interface FuzzyApi {
  /** True when the app was launched with FUZZY_E2E=1 (automated smoke tests). */
  e2e: boolean
  /** OS the renderer is running on — used to gate mac-only share targets. */
  platform: NodeJS.Platform
  health: {
    ping: () => Promise<HealthPingResult>
  }
  documents: {
    list: () => Promise<DocumentRecord[]>
    get: (id: string) => Promise<DocumentRecord | null>
    touch: (id: string) => Promise<{ ok: true }>
    delete: (id: string) => Promise<{ ok: true }>
    import: () => Promise<ImportResult | null>
    importSample: () => Promise<ImportResult | null>
    readFile: (id: string) => Promise<Uint8Array | null>
    recordPageExtraction: (
      documentId: string,
      page: ExtractedPagePayload
    ) => Promise<{ ok: true; pageCount: number }>
    setLastReadPage: (documentId: string, page: number) => Promise<{ ok: boolean }>
  }
  pages: {
    listForDocument: (documentId: string) => Promise<PageRecord[]>
  }
  thesis: {
    search: (request: ThesisSearchRequest) => Promise<ThesisSearchResult>
    getMetadata: (documentId: string) => Promise<DocMetadata | null>
    updateMetadata: (
      documentId: string,
      patch: Partial<DocMetadata>
    ) => Promise<DocumentRecord | null>
  }
  synthesis: {
    generate: (request: SynthesisRequest) => Promise<SynthesisResult>
  }
  summary: {
    digest: (documentId: string, targetMinutes: number) => Promise<DigestResult>
    chapters: (documentId: string) => Promise<ChapterSummariesResult>
  }
  evidence: {
    search: (request: EvidenceSearchRequest) => Promise<EvidenceSearchResult>
  }
  tone: {
    search: (request: ToneSearchRequest) => Promise<ToneSearchResult>
  }
  ask: {
    query: (request: AskRequest) => Promise<AskResult>
  }
  argument: {
    map: (documentId: string) => Promise<ArgumentMapResult>
  }
  glossary: {
    build: (documentId: string) => Promise<GlossaryResult>
  }
  essays: {
    list: () => Promise<EssayRecord[]>
    get: (id: string) => Promise<EssayRecord | null>
    create: (title: string, thesis: string, scope: ThesisScope) => Promise<EssayRecord>
    update: (
      id: string,
      patch: Partial<Pick<EssayRecord, 'title' | 'thesis' | 'scope' | 'outline' | 'draftMd'>>
    ) => Promise<EssayRecord | null>
    delete: (id: string) => Promise<{ ok: true }>
    generateOutline: (request: EssayOutlineRequest) => Promise<EssayOutline>
    draftParagraph: (request: EssayDraftRequest) => Promise<string>
  }
  entities: {
    list: (documentId: string) => Promise<EntityRecord[]>
    mentions: (entityId: string) => Promise<number[]>
    // Re-extract + AI-refine an already-imported document's cast. Returns count.
    rebuild: (documentId: string) => Promise<number>
  }
  focus: {
    start: (input: StartFocusSessionInput) => Promise<FocusSessionRecord>
    update: (id: string, progress: FocusSessionProgress) => Promise<{ ok: true }>
    end: (id: string, progress: FocusSessionProgress) => Promise<FocusSessionRecord | null>
    finalizeOpen: () => Promise<{ ok: true }>
    list: () => Promise<FocusSessionRecord[]>
    stats: () => Promise<ReadingStats>
  }
  projects: {
    list: () => Promise<ProjectRecord[]>
    create: (title: string, thesis?: string) => Promise<ProjectRecord>
    update: (
      id: string,
      patch: { title?: string; thesis?: string }
    ) => Promise<ProjectRecord | null>
    delete: (id: string) => Promise<{ ok: true }>
    getDetail: (id: string) => Promise<ProjectDetail | null>
    addEvidence: (projectId: string, passage: RankedPassage) => Promise<ProjectEvidenceRecord>
    removeEvidence: (id: string) => Promise<{ ok: true }>
    addNote: (projectId: string, content: string) => Promise<ProjectNoteRecord>
    updateNote: (id: string, content: string) => Promise<{ ok: true }>
    removeNote: (id: string) => Promise<{ ok: true }>
    addSynthesis: (
      projectId: string,
      thesis: string,
      result: SynthesisResult
    ) => Promise<ProjectSynthesisRecord>
    removeSynthesis: (id: string) => Promise<{ ok: true }>
    export: (id: string, format: CitationFormat, exportFormat: ExportFormat) => Promise<string>
  }
  annotations: {
    listForDocument: (documentId: string) => Promise<AnnotationRecord[]>
    create: (input: CreateAnnotationInput) => Promise<AnnotationRecord>
    delete: (id: string) => Promise<{ ok: true }>
  }
  aiResponses: {
    listForDocument: (documentId: string) => Promise<AiResponseRecord[]>
  }
  ai: {
    runAction: (request: AiActionRequest) => Promise<AiActionResult>
  }
  readingSessions: {
    create: (documentId: string, availableMinutes: number) => Promise<ReadingSessionRecord>
    getLatest: (documentId: string) => Promise<ReadingSessionRecord | null>
  }
  studyPacks: {
    generate: (documentId: string, options?: StudyPackOptions) => Promise<StudyPackRecord>
    getLatest: (documentId: string) => Promise<StudyPackRecord | null>
    list: (documentId: string) => Promise<StudyPackRecord[]>
    delete: (id: string) => Promise<{ ok: true }>
    exportText: (packId: string, format: StudyExportFormat) => Promise<string>
    exportFile: (
      packId: string,
      format: StudyExportFormat
    ) => Promise<{ ok: boolean; filePath?: string }>
    openQuizletCreate: () => Promise<{ ok: true }>
  }
  quizAttempts: {
    save: (input: {
      studyPackId: string
      documentId: string
      score: number
      total: number
      answers: QuizAttemptRecord['answers']
      startedAt: string
    }) => Promise<QuizAttemptRecord>
    list: (documentId: string) => Promise<QuizAttemptRecord[]>
    stats: (documentId: string) => Promise<QuizAttemptStats>
  }
  flashcardReviews: {
    forPack: (studyPackId: string) => Promise<Record<number, FlashcardReviewState>>
    grade: (
      studyPackId: string,
      documentId: string,
      cardIndex: number,
      grade: ReviewGrade
    ) => Promise<FlashcardReviewState>
    due: (limit?: number) => Promise<DueCard[]>
    dueCount: () => Promise<number>
  }
  highlights: {
    list: (filters?: HighlightSearchInput) => Promise<HighlightRecord[]>
    import: () => Promise<HighlightImportResult | null>
    create: (input: {
      sourceTitle: string
      text: string
      note?: string
      tags?: string[]
      sourceAuthor?: string | null
      sourceUrl?: string | null
      sourceLocation?: string | null
    }) => Promise<HighlightRecord>
    update: (
      id: string,
      patch: Partial<
        Pick<
          HighlightRecord,
          'sourceTitle' | 'sourceAuthor' | 'sourceUrl' | 'sourceLocation' | 'text' | 'note'
        >
      > & {
        tags?: string[]
        isFavorite?: boolean
      }
    ) => Promise<HighlightRecord | null>
    delete: (id: string) => Promise<{ ok: true }>
    grade: (id: string, grade: ReviewGrade) => Promise<HighlightRecord | null>
    due: (limit?: number) => Promise<HighlightRecord[]>
    dueCount: () => Promise<number>
    stats: () => Promise<HighlightStats>
    exportText: (target: HighlightExportTarget, filters?: HighlightSearchInput) => Promise<string>
    exportFile: (
      target: HighlightExportTarget,
      filters?: HighlightSearchInput
    ) => Promise<{ ok: boolean; filePath?: string }>
  }
  settings: {
    get: () => Promise<AppSettings>
    setProviderMode: (mode: ProviderMode) => Promise<AppSettings>
    setOpenaiKey: (key: string) => Promise<AppSettings>
    validateOpenaiKey: (key: string) => Promise<ValidateOpenaiKeyResult>
    setOpenaiModel: (model: string) => Promise<AppSettings>
    setOpenaiBaseUrl: (url: string | null) => Promise<AppSettings>
    clearOpenaiKey: () => Promise<AppSettings>
    setLastActiveDocumentId: (id: string | null) => Promise<AppSettings>
    getReaderPrefs: () => Promise<ReaderPrefs>
    setReaderPrefs: (patch: Partial<ReaderPrefs>) => Promise<ReaderPrefs>
    getAppearancePrefs: () => Promise<AppearancePrefs>
    setAppearancePrefs: (patch: Partial<AppearancePrefs>) => Promise<AppearancePrefs>
    getStudyPackPrefs: () => Promise<StudyPackPrefs>
    setStudyPackPrefs: (patch: Partial<StudyPackPrefs>) => Promise<StudyPackPrefs>
  }
  ambient: {
    classify: (
      documentId: string,
      pageNumber: number,
      text: string
    ) => Promise<AmbientClassification | null>
  }
  share: {
    savePng: (data: Uint8Array, defaultName: string) => Promise<{ ok: boolean; filePath?: string }>
    copyImage: (data: Uint8Array) => Promise<{ ok: true }>
    toMessages: (
      data: Uint8Array
    ) => Promise<{ ok: boolean; method?: 'clipboard-fallback'; error?: string }>
    openTwitterIntent: (text: string) => Promise<{ ok: true }>
  }
  spotify: {
    getStatus: () => Promise<SpotifyStatus>
    setClientId: (clientId: string) => Promise<SpotifyStatus>
    connect: () => Promise<SpotifyConnectResult>
    disconnect: () => Promise<SpotifyStatus>
    setPlaybackMode: (mode: SpotifyPlaybackMode) => Promise<SpotifyStatus>
    setGenrePreferences: (genres: string[]) => Promise<SpotifyStatus>
    suggestForMood: (
      classification: AmbientClassification,
      options?: SpotifySuggestionOptions
    ) => Promise<SpotifySuggestion | null>
    playSuggestion: (suggestion: SpotifySuggestion) => Promise<SpotifyPlaybackResult>
    restorePlayback: (snapshot: SpotifyPlaybackSnapshot) => Promise<SpotifyRestoreResult>
    openSuggestion: (suggestion: SpotifySuggestion) => Promise<{ ok: boolean; message?: string }>
  }
  obsidian: {
    getStatus: () => Promise<ObsidianStatus>
    pickVault: () => Promise<ObsidianStatus>
    clearVault: () => Promise<ObsidianStatus>
    readNote: (documentId: string) => Promise<string>
    writeNote: (documentId: string, content: string) => Promise<{ ok: true }>
    appendNote: (documentId: string, block: string) => Promise<{ ok: true }>
  }
  // Dev-only helpers are only exposed in development builds. Production
  // preload omits the field entirely.
  dev?: {
    seedDocument: () => Promise<DocumentRecord>
  }
}

// Renderer-facing Obsidian sync status. `vaultPath` is the folder the user
// picked (notes live under `<vaultPath>/<subfolder>/`); `connected` is just
// `vaultPath !== null`, surfaced for empty-state UX.
export interface ObsidianStatus {
  vaultPath: string | null
  subfolder: string
  connected: boolean
}

export interface HealthPingResult {
  ok: true
  appVersion: string
  electronVersion: string
  nodeVersion: string
  chromeVersion: string
}

// Result of a live OpenAI-key probe (via settings.validateOpenaiKey). Codes
// are mapped from the SDK error and are stable across both main and renderer.
export type ValidateOpenaiKeyResult =
  | { ok: true }
  | { ok: false; code: 'unauthorized' | 'network' | 'timeout' | 'unknown' }
