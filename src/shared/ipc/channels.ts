// Single source of truth for IPC channel names.
// Keeps preload and main in sync without string-typo bugs.

export const IpcChannels = {
  healthPing: 'health:ping',

  documentsList: 'documents:list',
  documentsGet: 'documents:get',
  documentsTouch: 'documents:touch',
  documentsDelete: 'documents:delete',
  documentsImport: 'documents:import',
  documentsImportSample: 'documents:importSample',
  documentsReadFile: 'documents:readFile',
  documentsRecordPageExtraction: 'documents:recordPageExtraction',

  pagesListForDocument: 'pages:listForDocument',

  annotationsListForDocument: 'annotations:listForDocument',
  annotationsCreate: 'annotations:create',
  annotationsDelete: 'annotations:delete',

  aiResponsesListForDocument: 'aiResponses:listForDocument',
  aiRunAction: 'ai:runAction',

  readingSessionsCreate: 'readingSessions:create',
  readingSessionsGetLatest: 'readingSessions:getLatest',

  studyPacksGenerate: 'studyPacks:generate',
  studyPacksGetLatest: 'studyPacks:getLatest',

  settingsGet: 'settings:get',
  settingsSetProviderMode: 'settings:setProviderMode',
  settingsSetOpenaiKey: 'settings:setOpenaiKey',
  settingsValidateOpenaiKey: 'settings:validateOpenaiKey',
  settingsSetOpenaiModel: 'settings:setOpenaiModel',
  settingsClearOpenaiKey: 'settings:clearOpenaiKey',
  settingsSetLastActiveDocumentId: 'settings:setLastActiveDocumentId',

  devSeedDocument: 'dev:seedDocument'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
