import { randomUUID } from 'crypto'
import { getDb } from '../../services/dbService'
import type {
  AnnotationRecord,
  AnnotationType,
  CreateAnnotationInput
} from '@shared/types/database'

interface AnnotationRow {
  id: string
  document_id: string
  page_number: number | null
  selected_text: string
  note: string
  annotation_type: string
  color: string | null
  position_json: string | null
  created_at: string
  updated_at: string | null
}

function toRecord(row: AnnotationRow): AnnotationRecord | null {
  let position: AnnotationRecord['position'] = null
  if (row.position_json) {
    try {
      position = JSON.parse(row.position_json)
    } catch (err) {
      console.error(`[fuzzy db] malformed JSON in annotations.position_json for id=${row.id}`, err)
      return null
    }
  }
  return {
    id: row.id,
    documentId: row.document_id,
    pageNumber: row.page_number,
    selectedText: row.selected_text,
    note: row.note,
    annotationType: row.annotation_type as AnnotationType,
    color: row.color,
    position,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function insertAnnotation(input: CreateAnnotationInput): AnnotationRecord {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const positionJson = input.position ? JSON.stringify(input.position) : null
  getDb()
    .prepare(
      `INSERT INTO annotations (
        id, document_id, page_number, selected_text, note, annotation_type,
        color, position_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.documentId,
      input.pageNumber,
      input.selectedText,
      input.note,
      input.annotationType,
      input.color ?? null,
      positionJson,
      createdAt,
      null
    )
  return {
    id,
    documentId: input.documentId,
    pageNumber: input.pageNumber,
    selectedText: input.selectedText,
    note: input.note,
    annotationType: input.annotationType,
    color: input.color ?? null,
    position: input.position ?? null,
    createdAt,
    updatedAt: null
  }
}

export function listAnnotationsForDocument(documentId: string): AnnotationRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM annotations WHERE document_id = ? ORDER BY created_at DESC`)
    .all(documentId) as AnnotationRow[]
  return rows.map(toRecord).filter((r): r is AnnotationRecord => r !== null)
}

export function deleteAnnotation(id: string): void {
  getDb().prepare(`DELETE FROM annotations WHERE id = ?`).run(id)
}
