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

export interface FuzzyApi {
  /** True when the app was launched with FUZZY_E2E=1 (automated smoke tests). */
  e2e: boolean
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
    update: (id: string, patch: { title?: string; thesis?: string }) => Promise<ProjectRecord | null>
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
  // Dev-only helpers are only exposed in development builds. Production
  // preload omits the field entirely.
  dev?: {
    seedDocument: () => Promise<DocumentRecord>
  }
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
