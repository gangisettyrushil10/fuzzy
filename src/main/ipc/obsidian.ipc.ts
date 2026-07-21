import { ipcMain, BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import {
  appendNoteForDocument,
  clearVault,
  getObsidianStatus,
  pickVaultFolder,
  readNoteForDocument,
  writeNoteForDocument
} from '../services/obsidianService'

const MAX_DOCUMENT_ID_CHARS = 64
const MAX_NOTE_CHARS = 200_000

// Hand-rolled validator (no zod), matching the annotation.ipc.ts pattern: throws
// a static, non-leaky Error and never echoes user-controlled strings back.
function assertDocumentId(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_DOCUMENT_ID_CHARS) {
    throw new Error('invalid obsidian input: documentId')
  }
  return value
}

export function registerObsidianIpc(): void {
  ipcMain.handle(IpcChannels.obsidianGetStatus, () => getObsidianStatus())

  ipcMain.handle(IpcChannels.obsidianPickVault, (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    return pickVaultFolder(win)
  })

  ipcMain.handle(IpcChannels.obsidianClearVault, () => clearVault())

  ipcMain.handle(IpcChannels.obsidianReadNote, (_e, documentId: unknown) =>
    readNoteForDocument(assertDocumentId(documentId))
  )

  ipcMain.handle(IpcChannels.obsidianWriteNote, (_e, documentId: unknown, content: unknown) => {
    const text = typeof content === 'string' ? content.slice(0, MAX_NOTE_CHARS) : ''
    return writeNoteForDocument(assertDocumentId(documentId), text)
  })

  ipcMain.handle(IpcChannels.obsidianAppendNote, (_e, documentId: unknown, block: unknown) => {
    const text = typeof block === 'string' ? block.slice(0, MAX_NOTE_CHARS) : ''
    if (!text.trim()) throw new Error('invalid obsidian input: block')
    return appendNoteForDocument(assertDocumentId(documentId), text)
  })
}
