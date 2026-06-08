import { app, dialog, BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { createHash } from 'crypto'
import { copyFile, mkdir, readFile, stat, unlink, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'
import {
  getDocument,
  getDocumentByHash,
  insertDocument,
  setPageCount,
  touchLastOpened,
  updateDocumentTitle
} from '../db/repositories/documentRepository'
import { bulkUpsertPages } from '../db/repositories/pageRepository'
import type { DocumentRecord, ImportResult } from '@shared/types/database'
import {
  FILE_FORMATS,
  allImportExtensions,
  extensionOf,
  fileTypeFromPath,
  type FileType
} from '@shared/formats'
import { assertInsideDir } from './pathSafety'
import { extractDocument } from './documentExtractor'
import { applyExtractedMetadata } from './thesis/metadataExtractor'
import { buildEntityIndex } from './entities/entityIndexService'
import { buildEmbeddingIndex } from './embeddings/embeddingService'
import { classifyAndStoreGenre } from './genre/genreService'

// Keep import responsive: very large files can make eager full-document
// extraction expensive enough to freeze/crash weaker machines.
const MAX_EAGER_INDEX_BYTES = 25 * 1024 * 1024

export class UnsupportedImportError extends Error {
  constructor(pathOrName: string) {
    super(`Unsupported file type: ${basename(pathOrName)}`)
    this.name = 'UnsupportedImportError'
  }
}

export function libraryDir(): string {
  return join(app.getPath('userData'), 'library')
}

async function ensureLibraryDir(): Promise<string> {
  const dir = libraryDir()
  await mkdir(dir, { recursive: true })
  return dir
}

async function sha256(filePath: string): Promise<string> {
  const buf = await readFile(filePath)
  return createHash('sha256').update(buf).digest('hex')
}

function deriveTitle(originalPath: string): string {
  const base = basename(originalPath)
  const ext = extname(base)
  return ext ? base.slice(0, base.length - ext.length) : base
}

// Open the native picker, copy to the local library, dedupe by content hash.
/** Path to the bundled sample PDF (public-domain style demo content). */
export function resolveSamplePdfPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'sample-document.pdf')
  }
  return join(app.getAppPath(), 'resources', 'sample-document.pdf')
}

export async function importSampleDocument(): Promise<ImportResult | null> {
  const samplePath = resolveSamplePdfPath()
  if (!existsSync(samplePath)) {
    throw new Error('Sample document is missing from the app bundle.')
  }
  const result = await importDocumentFromPath(samplePath)
  if (!result.deduped) {
    const updated = updateDocumentTitle(result.document.id, 'Fuzzy Sample — Study Guide')
    return { document: updated ?? result.document, deduped: false }
  }
  const doc = getDocument(result.document.id) ?? result.document
  return { document: doc, deduped: true }
}

// Build native dialog filters from the format registry: one combined
// "Documents" entry plus a per-format entry, so the picker reflects every
// supported type in one place.
function buildImportFilters(): Electron.FileFilter[] {
  const perFormat = Object.values(FILE_FORMATS).map((f) => ({
    name: f.label,
    extensions: f.extensions
  }))
  return [{ name: 'Documents', extensions: allImportExtensions() }, ...perFormat]
}

// Save arbitrary text to a user-chosen path via the native save dialog. Used by
// study-pack export. The user picks the destination, so there is no libraryDir
// containment check (unlike read/unlink which guard against poisoned paths).
export interface SaveTextResult {
  ok: boolean
  filePath?: string
}

export async function saveTextFile(
  parent: BrowserWindow | null,
  opts: { defaultName: string; content: string; filters?: Electron.FileFilter[] }
): Promise<SaveTextResult> {
  const options: Electron.SaveDialogOptions = {
    title: 'Export',
    defaultPath: opts.defaultName,
    filters: opts.filters ?? [{ name: 'All files', extensions: ['*'] }]
  }
  const picker = parent ? dialog.showSaveDialog(parent, options) : dialog.showSaveDialog(options)
  const { canceled, filePath } = await picker
  if (canceled || !filePath) return { ok: false }
  await writeFile(filePath, opts.content, 'utf-8')
  return { ok: true, filePath }
}

export async function openImportDialog(parent: BrowserWindow | null): Promise<ImportResult | null> {
  const options: Electron.OpenDialogOptions = {
    title: 'Import a document',
    properties: ['openFile'],
    filters: buildImportFilters()
  }
  const picker = parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options)
  const { canceled, filePaths } = await picker
  if (canceled || filePaths.length === 0) return null
  return importDocumentFromPath(filePaths[0])
}

export async function importDocumentFromPath(sourcePath: string): Promise<ImportResult> {
  const fileType = fileTypeFromPath(sourcePath)
  if (!fileType) throw new UnsupportedImportError(sourcePath)

  const dir = await ensureLibraryDir()
  const fileHash = await sha256(sourcePath)

  const existing = getDocumentByHash(fileHash)
  if (existing) {
    touchLastOpened(existing.id)
    return { document: existing, deduped: true }
  }

  // Use the hash as the on-disk name so dedupe and lookup are simple. Keep the
  // real extension so the file is openable outside Fuzzy and so extractors can
  // sniff by path when needed.
  const ext = extensionOf(sourcePath) || FILE_FORMATS[fileType].extensions[0]
  const targetName = `${fileHash}.${ext}`
  const targetPath = join(dir, targetName)
  await copyFile(sourcePath, targetPath)

  const sizeBytes = (await stat(targetPath)).size

  const document: DocumentRecord = insertDocument({
    title: deriveTitle(sourcePath),
    filePath: targetPath,
    fileHash,
    fileType,
    pageCount: null,
    fileSize: sizeBytes
  })

  // Best-effort citation metadata (author/year/publisher) for the Thesis
  // Workspace. Background + fail-soft; never blocks or fails the import. The
  // manual citation-details editor is the primary path regardless.
  void applyExtractedMetadata(document.id, targetPath, fileType)

  // Keep the import path snappy and resilient. Full-document extraction can be
  // expensive for large files; we run it in the background and let the
  // renderer's per-page extraction fill gaps lazily as the user reads.
  // Formats without an extractor yet import fine and stay un-indexed until
  // their per-format agent lands.
  if (FILE_FORMATS[fileType].extractorReady) {
    if (sizeBytes <= MAX_EAGER_INDEX_BYTES) {
      void indexDocumentText(document, targetPath, fileType).catch((err) => {
        console.warn('[fuzzy] background import indexing failed', err)
      })
    } else {
      console.info(
        `[fuzzy] skipping eager indexing for large ${fileType} (${Math.round(
          sizeBytes / (1024 * 1024)
        )} MB); renderer will index lazily`
      )
    }
  }

  return { document, deduped: false }
}

async function indexDocumentText(
  document: DocumentRecord,
  filePath: string,
  fileType: FileType
): Promise<void> {
  const extracted = await extractDocument(filePath, fileType)
  if (extracted.pages.length === 0) return
  bulkUpsertPages(
    document.id,
    extracted.pages.map((p) => ({
      documentId: document.id,
      pageNumber: p.pageNumber,
      textContent: p.textContent,
      htmlContent: p.htmlContent ?? null,
      estimatedWordCount: p.estimatedWordCount
    }))
  )
  setPageCount(document.id, extracted.pageCount)

  // Durable per-document indexes built once at import. All best-effort and
  // fail-soft — a failure here must never break import or reading. `extracted`
  // is reused (no second extraction). Genre first so it can inform the others.
  classifyAndStoreGenre(document.id, extracted)
  void buildEntityIndex(document.id, extracted).catch((e) =>
    console.warn('[fuzzy] entity index build failed', e)
  )
  void buildEmbeddingIndex(document.id, extracted).catch((e) =>
    console.warn('[fuzzy] embedding index build failed', e)
  )
}

// Reads bytes of a document stored under the library directory.
// Throws PathEscapeError if `filePath` resolves outside libraryDir — defends
// against renderer-supplied or DB-poisoned paths becoming an arbitrary file
// read primitive.
export async function readDocumentBytes(filePath: string): Promise<Uint8Array> {
  await assertInsideDir(libraryDir(), filePath)
  const buf = await readFile(filePath)
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

// Best-effort deletion of the on-disk PDF backing a deleted document row.
// Refuses to unlink anything outside libraryDir. Missing files are not an
// error — the row may already have been orphaned.
export async function unlinkDocumentFile(filePath: string): Promise<void> {
  try {
    await assertInsideDir(libraryDir(), filePath)
  } catch {
    // Path escape — silently refuse rather than touching anything outside
    // libraryDir. Callers can log if they care.
    return
  }
  try {
    await unlink(filePath)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | null)?.code
    if (code === 'ENOENT') return
    throw err
  }
}
