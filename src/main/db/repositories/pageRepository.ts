import { randomUUID } from 'crypto'
import { getDb } from '../../services/dbService'
import type { PageRecord } from '@shared/types/database'

interface PageRow {
  id: string
  document_id: string
  page_number: number
  text_content: string | null
  estimated_word_count: number
  complexity_score: number
  created_at: string
}

function toRecord(row: PageRow): PageRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    pageNumber: row.page_number,
    textContent: row.text_content,
    estimatedWordCount: row.estimated_word_count,
    complexityScore: row.complexity_score,
    createdAt: row.created_at
  }
}

export interface UpsertPageInput {
  documentId: string
  pageNumber: number
  textContent: string | null
  estimatedWordCount: number
  complexityScore?: number
}

export function upsertPage(input: UpsertPageInput): PageRecord {
  const existing = getDb()
    .prepare(`SELECT id FROM pages WHERE document_id = ? AND page_number = ?`)
    .get(input.documentId, input.pageNumber) as { id: string } | undefined

  if (existing) {
    getDb()
      .prepare(
        `UPDATE pages
         SET text_content = ?, estimated_word_count = ?, complexity_score = ?
         WHERE id = ?`
      )
      .run(input.textContent, input.estimatedWordCount, input.complexityScore ?? 0, existing.id)
    return getPageById(existing.id)!
  }

  const id = randomUUID()
  const createdAt = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO pages (id, document_id, page_number, text_content,
        estimated_word_count, complexity_score, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.documentId,
      input.pageNumber,
      input.textContent,
      input.estimatedWordCount,
      input.complexityScore ?? 0,
      createdAt
    )
  return {
    id,
    documentId: input.documentId,
    pageNumber: input.pageNumber,
    textContent: input.textContent,
    estimatedWordCount: input.estimatedWordCount,
    complexityScore: input.complexityScore ?? 0,
    createdAt
  }
}

export function getPageById(id: string): PageRecord | null {
  const row = getDb().prepare(`SELECT * FROM pages WHERE id = ?`).get(id) as PageRow | undefined
  return row ? toRecord(row) : null
}

export function listPagesForDocument(documentId: string): PageRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM pages WHERE document_id = ? ORDER BY page_number ASC`)
    .all(documentId) as PageRow[]
  return rows.map(toRecord)
}

export function getPageByNumber(documentId: string, pageNumber: number): PageRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM pages WHERE document_id = ? AND page_number = ?`)
    .get(documentId, pageNumber) as PageRow | undefined
  return row ? toRecord(row) : null
}

export function setComplexityScore(id: string, score: number): void {
  getDb().prepare(`UPDATE pages SET complexity_score = ? WHERE id = ?`).run(score, id)
}

// Used by the import flow to write every extracted page in one transaction.
// Bulk import of a 500-page PDF should be a single fsync, not 500.
export function bulkUpsertPages(documentId: string, pages: UpsertPageInput[]): void {
  if (pages.length === 0) return
  const db = getDb()
  const select = db.prepare(`SELECT id FROM pages WHERE document_id = ? AND page_number = ?`)
  const insert = db.prepare(
    `INSERT INTO pages (id, document_id, page_number, text_content,
      estimated_word_count, complexity_score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  const update = db.prepare(
    `UPDATE pages
     SET text_content = ?, estimated_word_count = ?, complexity_score = ?
     WHERE id = ?`
  )
  const runAll = db.transaction((items: UpsertPageInput[]) => {
    const createdAt = new Date().toISOString()
    for (const p of items) {
      const existing = select.get(documentId, p.pageNumber) as { id: string } | undefined
      if (existing) {
        update.run(p.textContent, p.estimatedWordCount, p.complexityScore ?? 0, existing.id)
      } else {
        insert.run(
          randomUUID(),
          documentId,
          p.pageNumber,
          p.textContent,
          p.estimatedWordCount,
          p.complexityScore ?? 0,
          createdAt
        )
      }
    }
  })
  runAll(pages)
}
