import { dialog, type BrowserWindow } from 'electron'
import { appendFile, mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { getDocument } from '../db/repositories/documentRepository'
import { readObsidianPrefs, writeObsidianPrefs } from './settingsService'
import { assertInsideDir } from './pathSafety'
import { pickNoteFilename, slugifyNoteTitle } from '@shared/obsidian'
import type { ObsidianStatus } from '@shared/types/api'

// Hard cap on a single note write/append so a bad renderer payload can't blow up
// a vault file. Notes are prose, so this is very generous.
const MAX_NOTE_CHARS = 200_000

// Thrown when a note read/write is attempted with no vault folder configured.
// IPC surfaces this as a stable, non-leaky error the renderer can special-case.
export class ObsidianVaultMissingError extends Error {
  readonly code = 'EOBS_NO_VAULT' as const
  constructor() {
    super('No Obsidian vault folder is configured.')
    this.name = 'ObsidianVaultMissingError'
  }
}

// Renderer-facing view of the config — never exposes the internal notePaths map.
export function getObsidianStatus(): ObsidianStatus {
  const prefs = readObsidianPrefs()
  return {
    vaultPath: prefs.vaultPath,
    subfolder: prefs.subfolder,
    connected: prefs.vaultPath !== null
  }
}

// Native folder picker → persist the chosen vault path. Returns the updated
// status (unchanged if the user cancels). Modeled on openImportDialog.
export async function pickVaultFolder(parent: BrowserWindow | null): Promise<ObsidianStatus> {
  const options: Electron.OpenDialogOptions = {
    title: 'Choose your Obsidian vault folder',
    properties: ['openDirectory', 'createDirectory']
  }
  const picker = parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options)
  const { canceled, filePaths } = await picker
  if (canceled || filePaths.length === 0) return getObsidianStatus()
  writeObsidianPrefs({ vaultPath: filePaths[0] })
  return getObsidianStatus()
}

export function clearVault(): ObsidianStatus {
  writeObsidianPrefs({ vaultPath: null })
  return getObsidianStatus()
}

// Resolve (and, on first use, create + persist) the absolute note-file path for a
// document. The file itself is not created here — only its folder. Every write
// path funnels through this so path-safety is enforced in exactly one place.
async function resolveNoteFile(documentId: string): Promise<string> {
  const prefs = readObsidianPrefs()
  if (!prefs.vaultPath) throw new ObsidianVaultMissingError()

  const notesDir = join(prefs.vaultPath, prefs.subfolder)
  await mkdir(notesDir, { recursive: true })

  let rel = prefs.notePaths[documentId]
  if (!rel) {
    const doc = getDocument(documentId)
    if (!doc) throw new Error('invalid obsidian input: documentId')
    const slug = slugifyNoteTitle(doc.title)
    // Dedupe only against names already claimed by *other* documents so an
    // existing unmapped `<slug>.md` is adopted (reconnecting reuses prior notes).
    rel = pickNoteFilename(slug, Object.values(prefs.notePaths))
    writeObsidianPrefs({ notePaths: { ...prefs.notePaths, [documentId]: rel } })
  }

  const targetPath = join(notesDir, rel)
  // Defense in depth: reject anything that resolves outside the vault, even
  // though the mapped filename is validated to be a single safe segment.
  await assertInsideDir(prefs.vaultPath, targetPath)
  return targetPath
}

// Read the document's note file. Missing file → empty string (the note simply
// hasn't been written yet). This is the file-as-truth read the panel loads on
// open, so edits made in Obsidian show up here.
export async function readNoteForDocument(documentId: string): Promise<string> {
  const targetPath = await resolveNoteFile(documentId)
  try {
    return await readFile(targetPath, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException | null)?.code === 'ENOENT') return ''
    throw err
  }
}

// Overwrite the document's note file with the panel's current content (debounced
// autosave target). The vault file is the source of truth.
export async function writeNoteForDocument(
  documentId: string,
  content: string
): Promise<{ ok: true }> {
  const text = typeof content === 'string' ? content.slice(0, MAX_NOTE_CHARS) : ''
  const targetPath = await resolveNoteFile(documentId)
  await writeFile(targetPath, text, 'utf-8')
  return { ok: true }
}

// Append a preformatted Markdown block (a highlight or a saved AI answer),
// keeping a blank line of separation from any existing content.
export async function appendNoteForDocument(
  documentId: string,
  markdownBlock: string
): Promise<{ ok: true }> {
  const block = (typeof markdownBlock === 'string' ? markdownBlock : '').slice(0, MAX_NOTE_CHARS)
  const targetPath = await resolveNoteFile(documentId)
  const existing = await readFile(targetPath, 'utf-8').catch(() => '')
  const separator = existing.length === 0 ? '' : existing.endsWith('\n') ? '\n' : '\n\n'
  await appendFile(targetPath, `${separator}${block.trimEnd()}\n`, 'utf-8')
  return { ok: true }
}
