import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import type { FuzzyApi } from '@shared/types/api'

// Build-time constant from electron-vite. True in `pnpm dev`, false in
// packaged builds. Omitting the `dev` field entirely from `window.fuzzy`
// in production keeps the dev-seed handler completely unreachable.
const IS_DEV = import.meta.env.DEV

const fuzzy: FuzzyApi = {
  e2e: process.env.FUZZY_E2E === '1',
  health: {
    ping: () => ipcRenderer.invoke(IpcChannels.healthPing)
  },
  documents: {
    list: () => ipcRenderer.invoke(IpcChannels.documentsList),
    get: (id) => ipcRenderer.invoke(IpcChannels.documentsGet, id),
    touch: (id) => ipcRenderer.invoke(IpcChannels.documentsTouch, id),
    delete: (id) => ipcRenderer.invoke(IpcChannels.documentsDelete, id),
    import: () => ipcRenderer.invoke(IpcChannels.documentsImport),
    importSample: () => ipcRenderer.invoke(IpcChannels.documentsImportSample),
    readFile: (id) => ipcRenderer.invoke(IpcChannels.documentsReadFile, id),
    recordPageExtraction: (documentId, page) =>
      ipcRenderer.invoke(IpcChannels.documentsRecordPageExtraction, documentId, page)
  },
  pages: {
    listForDocument: (documentId) =>
      ipcRenderer.invoke(IpcChannels.pagesListForDocument, documentId)
  },
  thesis: {
    search: (request) => ipcRenderer.invoke(IpcChannels.thesisSearch, request),
    getMetadata: (documentId) =>
      ipcRenderer.invoke(IpcChannels.documentsGetMetadata, documentId),
    updateMetadata: (documentId, patch) =>
      ipcRenderer.invoke(IpcChannels.documentsUpdateMetadata, documentId, patch)
  },
  synthesis: {
    generate: (request) => ipcRenderer.invoke(IpcChannels.synthesisGenerate, request)
  },
  summary: {
    digest: (documentId, targetMinutes) =>
      ipcRenderer.invoke(IpcChannels.summaryDigest, documentId, targetMinutes),
    chapters: (documentId) => ipcRenderer.invoke(IpcChannels.summaryChapters, documentId)
  },
  evidence: {
    search: (request) => ipcRenderer.invoke(IpcChannels.evidenceSearch, request)
  },
  tone: {
    search: (request) => ipcRenderer.invoke(IpcChannels.toneSearch, request)
  },
  ask: {
    query: (request) => ipcRenderer.invoke(IpcChannels.askQuery, request)
  },
  essays: {
    list: () => ipcRenderer.invoke(IpcChannels.essaysList),
    get: (id) => ipcRenderer.invoke(IpcChannels.essaysGet, id),
    create: (title, thesis, scope) => ipcRenderer.invoke(IpcChannels.essaysCreate, title, thesis, scope),
    update: (id, patch) => ipcRenderer.invoke(IpcChannels.essaysUpdate, id, patch),
    delete: (id) => ipcRenderer.invoke(IpcChannels.essaysDelete, id),
    generateOutline: (request) => ipcRenderer.invoke(IpcChannels.essaysGenerateOutline, request),
    draftParagraph: (request) => ipcRenderer.invoke(IpcChannels.essaysDraftParagraph, request)
  },
  entities: {
    list: (documentId) => ipcRenderer.invoke(IpcChannels.entitiesList, documentId),
    mentions: (entityId) => ipcRenderer.invoke(IpcChannels.entitiesMentions, entityId)
  },
  focus: {
    start: (input) => ipcRenderer.invoke(IpcChannels.focusStart, input),
    update: (id, progress) => ipcRenderer.invoke(IpcChannels.focusUpdate, id, progress),
    end: (id, progress) => ipcRenderer.invoke(IpcChannels.focusEnd, id, progress),
    finalizeOpen: () => ipcRenderer.invoke(IpcChannels.focusFinalizeOpen),
    list: () => ipcRenderer.invoke(IpcChannels.focusList),
    stats: () => ipcRenderer.invoke(IpcChannels.focusStats)
  },
  projects: {
    list: () => ipcRenderer.invoke(IpcChannels.projectsList),
    create: (title, thesis) => ipcRenderer.invoke(IpcChannels.projectsCreate, title, thesis),
    update: (id, patch) => ipcRenderer.invoke(IpcChannels.projectsUpdate, id, patch),
    delete: (id) => ipcRenderer.invoke(IpcChannels.projectsDelete, id),
    getDetail: (id) => ipcRenderer.invoke(IpcChannels.projectsGetDetail, id),
    addEvidence: (projectId, passage) =>
      ipcRenderer.invoke(IpcChannels.projectsAddEvidence, projectId, passage),
    removeEvidence: (id) => ipcRenderer.invoke(IpcChannels.projectsRemoveEvidence, id),
    addNote: (projectId, content) =>
      ipcRenderer.invoke(IpcChannels.projectsAddNote, projectId, content),
    updateNote: (id, content) => ipcRenderer.invoke(IpcChannels.projectsUpdateNote, id, content),
    removeNote: (id) => ipcRenderer.invoke(IpcChannels.projectsRemoveNote, id),
    addSynthesis: (projectId, thesis, result) =>
      ipcRenderer.invoke(IpcChannels.projectsAddSynthesis, projectId, thesis, result),
    removeSynthesis: (id) => ipcRenderer.invoke(IpcChannels.projectsRemoveSynthesis, id),
    export: (id, format, exportFormat) =>
      ipcRenderer.invoke(IpcChannels.projectsExport, id, format, exportFormat)
  },
  annotations: {
    listForDocument: (documentId) =>
      ipcRenderer.invoke(IpcChannels.annotationsListForDocument, documentId),
    create: (input) => ipcRenderer.invoke(IpcChannels.annotationsCreate, input),
    delete: (id) => ipcRenderer.invoke(IpcChannels.annotationsDelete, id)
  },
  aiResponses: {
    listForDocument: (documentId) =>
      ipcRenderer.invoke(IpcChannels.aiResponsesListForDocument, documentId)
  },
  ai: {
    runAction: (request) => ipcRenderer.invoke(IpcChannels.aiRunAction, request)
  },
  readingSessions: {
    create: (documentId, availableMinutes) =>
      ipcRenderer.invoke(IpcChannels.readingSessionsCreate, documentId, availableMinutes),
    getLatest: (documentId) => ipcRenderer.invoke(IpcChannels.readingSessionsGetLatest, documentId)
  },
  studyPacks: {
    generate: (documentId, options) =>
      ipcRenderer.invoke(IpcChannels.studyPacksGenerate, documentId, options),
    getLatest: (documentId) => ipcRenderer.invoke(IpcChannels.studyPacksGetLatest, documentId),
    list: (documentId) => ipcRenderer.invoke(IpcChannels.studyPacksList, documentId),
    delete: (id) => ipcRenderer.invoke(IpcChannels.studyPacksDelete, id),
    exportText: (packId, format) =>
      ipcRenderer.invoke(IpcChannels.studyPacksExportText, packId, format),
    exportFile: (packId, format) =>
      ipcRenderer.invoke(IpcChannels.studyPacksExportFile, packId, format),
    openQuizletCreate: () => ipcRenderer.invoke(IpcChannels.studyPacksOpenQuizlet)
  },
  quizAttempts: {
    save: (input) => ipcRenderer.invoke(IpcChannels.quizAttemptsSave, input),
    list: (documentId) => ipcRenderer.invoke(IpcChannels.quizAttemptsList, documentId),
    stats: (documentId) => ipcRenderer.invoke(IpcChannels.quizAttemptsStats, documentId)
  },
  flashcardReviews: {
    forPack: (studyPackId) =>
      ipcRenderer.invoke(IpcChannels.flashcardReviewsForPack, studyPackId),
    grade: (studyPackId, documentId, cardIndex, grade) =>
      ipcRenderer.invoke(
        IpcChannels.flashcardReviewsGrade,
        studyPackId,
        documentId,
        cardIndex,
        grade
      ),
    due: (limit) => ipcRenderer.invoke(IpcChannels.flashcardReviewsDue, limit),
    dueCount: () => ipcRenderer.invoke(IpcChannels.flashcardReviewsDueCount)
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannels.settingsGet),
    setProviderMode: (mode) => ipcRenderer.invoke(IpcChannels.settingsSetProviderMode, mode),
    setOpenaiKey: (key) => ipcRenderer.invoke(IpcChannels.settingsSetOpenaiKey, key),
    validateOpenaiKey: (key) => ipcRenderer.invoke(IpcChannels.settingsValidateOpenaiKey, key),
    setOpenaiModel: (model) => ipcRenderer.invoke(IpcChannels.settingsSetOpenaiModel, model),
    setOpenaiBaseUrl: (url) => ipcRenderer.invoke(IpcChannels.settingsSetOpenaiBaseUrl, url),
    clearOpenaiKey: () => ipcRenderer.invoke(IpcChannels.settingsClearOpenaiKey),
    setLastActiveDocumentId: (id) =>
      ipcRenderer.invoke(IpcChannels.settingsSetLastActiveDocumentId, id),
    getReaderPrefs: () => ipcRenderer.invoke(IpcChannels.settingsGetReaderPrefs),
    setReaderPrefs: (patch) => ipcRenderer.invoke(IpcChannels.settingsSetReaderPrefs, patch),
    getAppearancePrefs: () => ipcRenderer.invoke(IpcChannels.settingsGetAppearancePrefs),
    setAppearancePrefs: (patch) =>
      ipcRenderer.invoke(IpcChannels.settingsSetAppearancePrefs, patch),
    getStudyPackPrefs: () => ipcRenderer.invoke(IpcChannels.settingsGetStudyPackPrefs),
    setStudyPackPrefs: (patch) => ipcRenderer.invoke(IpcChannels.settingsSetStudyPackPrefs, patch)
  },
  ...(IS_DEV
    ? {
        dev: {
          seedDocument: () => ipcRenderer.invoke(IpcChannels.devSeedDocument)
        }
      }
    : {})
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('fuzzy', fuzzy)
  } catch (error) {
    console.error('[fuzzy preload] failed to expose bridge:', error)
  }
} else {
  // contextIsolation is required; this branch should never run in production.
  // @ts-expect-error attaching to window without isolation
  window.fuzzy = fuzzy
}
