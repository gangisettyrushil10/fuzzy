import { randomUUID } from 'crypto'
import { getDb } from '../../services/dbService'
import { DOCUMENT_GENRES, type DocMetadata, type DocumentGenre, type DocumentRecord } from '@shared/types/database'
import { isFileType, type FileType } from '@shared/formats'

interface DocumentRow {
  id: string
  title: string
  file_path: string
  file_hash: string | null
  file_type: string
  page_count: number | null
  file_size: number | null
  imported_at: string
  last_opened_at: string | null
  author: string | null
  year: number | null
  publisher: string | null
  source_url: string | null
  genre: string | null
}

const DOC_COLUMNS = `id, title, file_path, file_hash, file_type, page_count, file_size, imported_at, last_opened_at, author, year, publisher, source_url, genre`

function coerceGenre(value: string | null): DocumentGenre | null {
  return value && (DOCUMENT_GENRES as readonly string[]).includes(value)
    ? (value as DocumentGenre)
    : null
}

// Defensive: a row written before multi-format support (or hand-edited) may
// carry an unknown/empty file_type. Fall back to 'pdf' so the reader-switch
// always receives a valid FileType.
function coerceFileType(value: string | null): FileType {
  return isFileType(value) ? value : 'pdf'
}

function toRecord(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    title: row.title,
    filePath: row.file_path,
    fileHash: row.file_hash,
    fileType: coerceFileType(row.file_type),
    pageCount: row.page_count,
    fileSize: row.file_size,
    importedAt: row.imported_at,
    lastOpenedAt: row.last_opened_at,
    author: row.author,
    year: row.year,
    publisher: row.publisher,
    sourceUrl: row.source_url,
    genre: coerceGenre(row.genre)
  }
}

export interface CreateDocumentInput {
  title: string
  filePath: string
  fileType: FileType
  fileHash?: string | null
  pageCount?: number | null
  fileSize?: number | null
}

export function insertDocument(input: CreateDocumentInput): DocumentRecord {
  const id = randomUUID()
  const importedAt = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO documents (id, title, file_path, file_hash, file_type, page_count, file_size, imported_at, last_opened_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.title,
      input.filePath,
      input.fileHash ?? null,
      input.fileType,
      input.pageCount ?? null,
      input.fileSize ?? null,
      importedAt,
      null
    )
  return {
    id,
    title: input.title,
    filePath: input.filePath,
    fileHash: input.fileHash ?? null,
    fileType: input.fileType,
    pageCount: input.pageCount ?? null,
    fileSize: input.fileSize ?? null,
    importedAt,
    lastOpenedAt: null,
    author: null,
    year: null,
    publisher: null,
    sourceUrl: null,
    genre: null
  }
}

export function listDocuments(): DocumentRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT ${DOC_COLUMNS}
       FROM documents
       ORDER BY COALESCE(last_opened_at, imported_at) DESC`
    )
    .all() as DocumentRow[]
  return rows.map(toRecord)
}

export function getDocument(id: string): DocumentRecord | null {
  const row = getDb().prepare(`SELECT ${DOC_COLUMNS} FROM documents WHERE id = ?`).get(id) as
    | DocumentRow
    | undefined
  return row ? toRecord(row) : null
}

export function getDocumentByHash(fileHash: string): DocumentRecord | null {
  const row = getDb()
    .prepare(`SELECT ${DOC_COLUMNS} FROM documents WHERE file_hash = ?`)
    .get(fileHash) as DocumentRow | undefined
  return row ? toRecord(row) : null
}

export function touchLastOpened(id: string): void {
  getDb()
    .prepare(`UPDATE documents SET last_opened_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), id)
}

export function deleteDocument(id: string): void {
  getDb().prepare(`DELETE FROM documents WHERE id = ?`).run(id)
}

export function setPageCount(id: string, pageCount: number): void {
  getDb().prepare(`UPDATE documents SET page_count = ? WHERE id = ?`).run(pageCount, id)
}

// Persist the detected/overridden genre. Best-effort: set once at import,
// user-overridable later.
export function setDocumentGenre(id: string, genre: DocumentGenre | null): void {
  getDb().prepare(`UPDATE documents SET genre = ? WHERE id = ?`).run(genre, id)
}

export function updateDocumentTitle(id: string, title: string): DocumentRecord | null {
  getDb().prepare(`UPDATE documents SET title = ? WHERE id = ?`).run(title, id)
  return getDocument(id)
}

export function getDocMetadata(id: string): DocMetadata | null {
  const doc = getDocument(id)
  if (!doc) return null
  return {
    author: doc.author,
    year: doc.year,
    publisher: doc.publisher,
    sourceUrl: doc.sourceUrl
  }
}

// Update only the citation fields present in `patch`. A missing key is left
// untouched; an explicit null clears the field.
export function updateDocumentMetadata(
  id: string,
  patch: Partial<DocMetadata>
): DocumentRecord | null {
  const sets: string[] = []
  const values: Array<string | number | null> = []
  if ('author' in patch) {
    sets.push('author = ?')
    values.push(patch.author ?? null)
  }
  if ('year' in patch) {
    sets.push('year = ?')
    values.push(patch.year ?? null)
  }
  if ('publisher' in patch) {
    sets.push('publisher = ?')
    values.push(patch.publisher ?? null)
  }
  if ('sourceUrl' in patch) {
    sets.push('source_url = ?')
    values.push(patch.sourceUrl ?? null)
  }
  if (sets.length === 0) return getDocument(id)
  values.push(id)
  getDb()
    .prepare(`UPDATE documents SET ${sets.join(', ')} WHERE id = ?`)
    .run(...values)
  return getDocument(id)
}
