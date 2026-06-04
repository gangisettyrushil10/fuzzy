import { app, dialog, BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { createHash } from 'crypto'
import { copyFile, mkdir, readFile, stat, unlink } from 'fs/promises'
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
import { assertInsideDir } from './pathSafety'
import { extractAllPages } from './pdfTextExtractor'

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
  const result = await importPdfFromPath(samplePath)
  if (!result.deduped) {
    const updated = updateDocumentTitle(result.document.id, 'Fuzzy Sample — Study Guide')
    return { document: updated ?? result.document, deduped: false }
  }
  const doc = getDocument(result.document.id) ?? result.document
  return { document: doc, deduped: true }
}

export async function openImportDialog(parent: BrowserWindow | null): Promise<ImportResult | null> {
  const picker = parent
    ? dialog.showOpenDialog(parent, {
        title: 'Import a PDF',
        properties: ['openFile'],
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
    : dialog.showOpenDialog({
        title: 'Import a PDF',
        properties: ['openFile'],
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
  const { canceled, filePaths } = await picker
  if (canceled || filePaths.length === 0) return null
  return importPdfFromPath(filePaths[0])
}

export async function importPdfFromPath(sourcePath: string): Promise<ImportResult> {
  const dir = await ensureLibraryDir()
  const fileHash = await sha256(sourcePath)

  const existing = getDocumentByHash(fileHash)
  if (existing) {
    touchLastOpened(existing.id)
    return { document: existing, deduped: true }
  }

  // Use the hash as the on-disk name so dedupe and lookup are simple.
  const targetName = `${fileHash}.pdf`
  const targetPath = join(dir, targetName)
  await copyFile(sourcePath, targetPath)

  const sizeBytes = (await stat(targetPath)).size

  const document: DocumentRecord = insertDocument({
    title: deriveTitle(sourcePath),
    filePath: targetPath,
    fileHash,
    pageCount: null,
    fileSize: sizeBytes
  })

  // Index the document immediately so reading plans, study packs, and the
  // bottom bar's "pages indexed" counter see real numbers — not the
  // visited-pages-only count we used to settle for. Failures here are
  // logged but don't fail the import; the renderer's per-page fallback
  // extraction will still fill rows lazily.
  await indexDocumentText(document, targetPath).catch((err) => {
    console.warn('[fuzzy] import-time extraction failed', err)
  })

  // Re-read so the returned record carries the freshly-written page_count.
  const refreshed = getDocumentByHash(fileHash) ?? document
  return { document: refreshed, deduped: false }
}

async function indexDocumentText(document: DocumentRecord, filePath: string): Promise<void> {
  const extracted = await extractAllPages(filePath)
  if (extracted.pages.length === 0) return
  bulkUpsertPages(
    document.id,
    extracted.pages.map((p) => ({
      documentId: document.id,
      pageNumber: p.pageNumber,
      textContent: p.textContent,
      estimatedWordCount: p.estimatedWordCount
    }))
  )
  setPageCount(document.id, extracted.pageCount)
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
