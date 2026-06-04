import { randomUUID } from 'crypto'
import { getDb } from '../../services/dbService'
import type { DocumentRecord } from '@shared/types/database'

interface DocumentRow {
  id: string
  title: string
  file_path: string
  file_hash: string | null
  page_count: number | null
  file_size: number | null
  imported_at: string
  last_opened_at: string | null
}

function toRecord(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    title: row.title,
    filePath: row.file_path,
    fileHash: row.file_hash,
    pageCount: row.page_count,
    fileSize: row.file_size,
    importedAt: row.imported_at,
    lastOpenedAt: row.last_opened_at
  }
}

export interface CreateDocumentInput {
  title: string
  filePath: string
  fileHash?: string | null
  pageCount?: number | null
  fileSize?: number | null
}

export function insertDocument(input: CreateDocumentInput): DocumentRecord {
  const id = randomUUID()
  const importedAt = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO documents (id, title, file_path, file_hash, page_count, file_size, imported_at, last_opened_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.title,
      input.filePath,
      input.fileHash ?? null,
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
    pageCount: input.pageCount ?? null,
    fileSize: input.fileSize ?? null,
    importedAt,
    lastOpenedAt: null
  }
}

export function listDocuments(): DocumentRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT id, title, file_path, file_hash, page_count, file_size, imported_at, last_opened_at
       FROM documents
       ORDER BY COALESCE(last_opened_at, imported_at) DESC`
    )
    .all() as DocumentRow[]
  return rows.map(toRecord)
}

export function getDocument(id: string): DocumentRecord | null {
  const row = getDb()
    .prepare(
      `SELECT id, title, file_path, file_hash, page_count, file_size, imported_at, last_opened_at
       FROM documents WHERE id = ?`
    )
    .get(id) as DocumentRow | undefined
  return row ? toRecord(row) : null
}

export function getDocumentByHash(fileHash: string): DocumentRecord | null {
  const row = getDb()
    .prepare(
      `SELECT id, title, file_path, file_hash, page_count, file_size, imported_at, last_opened_at
       FROM documents WHERE file_hash = ?`
    )
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

export function updateDocumentTitle(id: string, title: string): DocumentRecord | null {
  getDb().prepare(`UPDATE documents SET title = ? WHERE id = ?`).run(title, id)
  return getDocument(id)
}
