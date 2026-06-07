import { ipcMain, shell, BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import { getStudyPackById } from '../db/repositories/studyPackRepository'
import {
  buildStudyExport,
  extensionForFormat
} from '../services/export/studyPackExportService'
import { saveTextFile } from '../services/fileService'
import type { StudyExportFormat } from '@shared/types/database'

const FORMATS: StudyExportFormat[] = ['quizlet', 'anki', 'csv', 'markdown']

function asFormat(raw: unknown): StudyExportFormat {
  return FORMATS.includes(raw as StudyExportFormat) ? (raw as StudyExportFormat) : 'quizlet'
}

// Filename-safe slug from a pack title.
function slug(title: string): string {
  return (title || 'study-pack').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'study-pack'
}

export function registerStudyPackExportIpc(): void {
  // Returns the export text so the renderer can copy it to the clipboard.
  ipcMain.handle(IpcChannels.studyPacksExportText, (_e, packId: unknown, format: unknown) => {
    if (typeof packId !== 'string' || !packId) throw new Error('packId is required.')
    const pack = getStudyPackById(packId)
    if (!pack) throw new Error('Study pack not found.')
    return buildStudyExport(pack, asFormat(format))
  })

  // Native save dialog → write file. Returns { ok, filePath? }.
  ipcMain.handle(
    IpcChannels.studyPacksExportFile,
    async (event, packId: unknown, format: unknown) => {
      if (typeof packId !== 'string' || !packId) throw new Error('packId is required.')
      const pack = getStudyPackById(packId)
      if (!pack) throw new Error('Study pack not found.')
      const fmt = asFormat(format)
      const ext = extensionForFormat(fmt)
      const win = BrowserWindow.fromWebContents(event.sender)
      return saveTextFile(win, {
        defaultName: `${slug(pack.title)}.${ext}`,
        content: buildStudyExport(pack, fmt),
        filters: [{ name: fmt.toUpperCase(), extensions: [ext] }]
      })
    }
  )

  // Open Quizlet's Create page in the default browser so the user pastes the
  // copied text. Quizlet has no public write API.
  ipcMain.handle(IpcChannels.studyPacksOpenQuizlet, async () => {
    await shell.openExternal('https://quizlet.com/create-set')
    return { ok: true }
  })
}
