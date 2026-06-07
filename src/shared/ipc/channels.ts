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

  documentsGetMetadata: 'documents:getMetadata',
  documentsUpdateMetadata: 'documents:updateMetadata',
  thesisSearch: 'thesis:search',
  synthesisGenerate: 'synthesis:generate',
  summaryDigest: 'summary:digest',
  summaryChapters: 'summary:chapters',
  evidenceSearch: 'evidence:search',
  entitiesList: 'entities:list',
  entitiesMentions: 'entities:mentions',
  toneSearch: 'tone:search',
  askQuery: 'ask:query',
  argumentMap: 'argument:map',

  essaysList: 'essays:list',
  essaysGet: 'essays:get',
  essaysCreate: 'essays:create',
  essaysUpdate: 'essays:update',
  essaysDelete: 'essays:delete',
  essaysGenerateOutline: 'essays:generateOutline',
  essaysDraftParagraph: 'essays:draftParagraph',

  focusStart: 'focus:start',
  focusUpdate: 'focus:update',
  focusEnd: 'focus:end',
  focusFinalizeOpen: 'focus:finalizeOpen',
  focusList: 'focus:list',
  focusStats: 'focus:stats',

  projectsList: 'projects:list',
  projectsCreate: 'projects:create',
  projectsUpdate: 'projects:update',
  projectsDelete: 'projects:delete',
  projectsGetDetail: 'projects:getDetail',
  projectsAddEvidence: 'projects:addEvidence',
  projectsRemoveEvidence: 'projects:removeEvidence',
  projectsAddNote: 'projects:addNote',
  projectsUpdateNote: 'projects:updateNote',
  projectsRemoveNote: 'projects:removeNote',
  projectsAddSynthesis: 'projects:addSynthesis',
  projectsRemoveSynthesis: 'projects:removeSynthesis',
  projectsExport: 'projects:export',

  annotationsListForDocument: 'annotations:listForDocument',
  annotationsCreate: 'annotations:create',
  annotationsDelete: 'annotations:delete',

  aiResponsesListForDocument: 'aiResponses:listForDocument',
  aiRunAction: 'ai:runAction',

  readingSessionsCreate: 'readingSessions:create',
  readingSessionsGetLatest: 'readingSessions:getLatest',

  studyPacksGenerate: 'studyPacks:generate',
  studyPacksGetLatest: 'studyPacks:getLatest',
  studyPacksList: 'studyPacks:list',
  studyPacksDelete: 'studyPacks:delete',
  studyPacksExportText: 'studyPacks:exportText',
  studyPacksExportFile: 'studyPacks:exportFile',
  studyPacksOpenQuizlet: 'studyPacks:openQuizlet',

  quizAttemptsSave: 'quizAttempts:save',
  quizAttemptsList: 'quizAttempts:list',
  quizAttemptsStats: 'quizAttempts:stats',

  flashcardReviewsForPack: 'flashcardReviews:forPack',
  flashcardReviewsGrade: 'flashcardReviews:grade',
  flashcardReviewsDue: 'flashcardReviews:due',
  flashcardReviewsDueCount: 'flashcardReviews:dueCount',

  settingsGet: 'settings:get',
  settingsSetProviderMode: 'settings:setProviderMode',
  settingsSetOpenaiKey: 'settings:setOpenaiKey',
  settingsValidateOpenaiKey: 'settings:validateOpenaiKey',
  settingsSetOpenaiModel: 'settings:setOpenaiModel',
  settingsSetOpenaiBaseUrl: 'settings:setOpenaiBaseUrl',
  settingsClearOpenaiKey: 'settings:clearOpenaiKey',
  settingsSetLastActiveDocumentId: 'settings:setLastActiveDocumentId',
  settingsGetReaderPrefs: 'settings:getReaderPrefs',
  settingsSetReaderPrefs: 'settings:setReaderPrefs',
  settingsGetAppearancePrefs: 'settings:getAppearancePrefs',
  settingsSetAppearancePrefs: 'settings:setAppearancePrefs',
  settingsGetStudyPackPrefs: 'settings:getStudyPackPrefs',
  settingsSetStudyPackPrefs: 'settings:setStudyPackPrefs',

  devSeedDocument: 'dev:seedDocument'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
