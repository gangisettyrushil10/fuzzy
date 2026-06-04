// Typed bridge surface exposed from preload to renderer as `window.fuzzy`.
// Each slice extends this interface as new IPC channels come online.

import type {
  AiActionRequest,
  AiActionResult,
  AiResponseRecord,
  AnnotationRecord,
  AppSettings,
  CreateAnnotationInput,
  DocumentRecord,
  ExtractedPagePayload,
  ImportResult,
  PageRecord,
  ProviderMode,
  ReadingSessionRecord,
  StudyPackRecord
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
    generate: (documentId: string) => Promise<StudyPackRecord>
    getLatest: (documentId: string) => Promise<StudyPackRecord | null>
  }
  settings: {
    get: () => Promise<AppSettings>
    setProviderMode: (mode: ProviderMode) => Promise<AppSettings>
    setOpenaiKey: (key: string) => Promise<AppSettings>
    validateOpenaiKey: (key: string) => Promise<ValidateOpenaiKeyResult>
    setOpenaiModel: (model: string) => Promise<AppSettings>
    clearOpenaiKey: () => Promise<AppSettings>
    setLastActiveDocumentId: (id: string | null) => Promise<AppSettings>
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
