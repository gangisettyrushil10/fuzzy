import { registerHealthIpc } from './health.ipc'
import { registerDocumentIpc } from './document.ipc'
import { registerAnnotationIpc } from './annotation.ipc'
import { registerAiIpc } from './ai.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerReadingSessionIpc } from './readingSession.ipc'
import { registerStudyPackIpc } from './studyPack.ipc'

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
}
