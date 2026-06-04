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
    generate: (documentId) => ipcRenderer.invoke(IpcChannels.studyPacksGenerate, documentId),
    getLatest: (documentId) => ipcRenderer.invoke(IpcChannels.studyPacksGetLatest, documentId)
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannels.settingsGet),
    setProviderMode: (mode) => ipcRenderer.invoke(IpcChannels.settingsSetProviderMode, mode),
    setOpenaiKey: (key) => ipcRenderer.invoke(IpcChannels.settingsSetOpenaiKey, key),
    validateOpenaiKey: (key) => ipcRenderer.invoke(IpcChannels.settingsValidateOpenaiKey, key),
    setOpenaiModel: (model) => ipcRenderer.invoke(IpcChannels.settingsSetOpenaiModel, model),
    clearOpenaiKey: () => ipcRenderer.invoke(IpcChannels.settingsClearOpenaiKey),
    setLastActiveDocumentId: (id) =>
      ipcRenderer.invoke(IpcChannels.settingsSetLastActiveDocumentId, id)
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
