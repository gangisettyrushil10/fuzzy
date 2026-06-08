import { registerHealthIpc } from './health.ipc'
import { registerDocumentIpc } from './document.ipc'
import { registerAnnotationIpc } from './annotation.ipc'
import { registerAiIpc } from './ai.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerReadingSessionIpc } from './readingSession.ipc'
import { registerStudyPackIpc } from './studyPack.ipc'
import { registerStudyPackExportIpc } from './studyPackExport.ipc'
import { registerStudyReviewIpc } from './studyReview.ipc'
import { registerThesisIpc } from './thesis.ipc'
import { registerProjectsIpc } from './projects.ipc'
import { registerSynthesisIpc } from './synthesis.ipc'
import { registerFocusSessionIpc } from './focusSession.ipc'
import { registerSummaryIpc } from './summary.ipc'
import { registerEvidenceIpc } from './evidence.ipc'
import { registerToneIpc } from './tone.ipc'
import { registerAskIpc } from './ask.ipc'
import { registerEssayIpc } from './essay.ipc'
import { registerArgumentIpc } from './argument.ipc'
import { registerGlossaryIpc } from './glossary.ipc'

// Central registration for all main-process IPC handlers.
// Each slice adds one call here as it ships.
export function registerIpcHandlers(): void {
  registerHealthIpc()
  registerDocumentIpc()
  registerAnnotationIpc()
  registerAiIpc()
  registerSettingsIpc()
  registerReadingSessionIpc()
  registerStudyPackIpc()
  registerStudyPackExportIpc()
  registerStudyReviewIpc()
  registerThesisIpc()
  registerProjectsIpc()
  registerSynthesisIpc()
  registerFocusSessionIpc()
  registerSummaryIpc()
  registerEvidenceIpc()
  registerToneIpc()
  registerAskIpc()
  registerEssayIpc()
  registerArgumentIpc()
  registerGlossaryIpc()
}
