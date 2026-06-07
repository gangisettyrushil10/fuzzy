import { randomUUID } from 'crypto'
import { getDb } from '../../services/dbService'
import type {
  Flashcard,
  QuizQuestion,
  StudyPackOptions,
  StudyPackRecord
} from '@shared/types/database'

interface StudyPackRow {
  id: string
  document_id: string
  title: string
  summary: string | null
  flashcards_json: string | null
  quiz_json: string | null
  key_concepts_json: string | null
  options_json: string | null
  created_at: string
}

function parseJsonField<T>(
  raw: string | null,
  rowId: string,
  column: string,
  fallback: T
): { value: T; ok: boolean } {
  if (!raw) return { value: fallback, ok: true }
  try {
    return { value: JSON.parse(raw) as T, ok: true }
  } catch (err) {
    console.error(`[fuzzy db] malformed JSON in study_packs.${column} for id=${rowId}`, err)
    return { value: fallback, ok: false }
  }
}

function toRecord(row: StudyPackRow): StudyPackRecord | null {
  const flashcards = parseJsonField<Flashcard[]>(row.flashcards_json, row.id, 'flashcards_json', [])
  const quiz = parseJsonField<QuizQuestion[]>(row.quiz_json, row.id, 'quiz_json', [])
  const keyConcepts = parseJsonField<string[]>(
    row.key_concepts_json,
    row.id,
    'key_concepts_json',
    []
  )
  // options_json is best-effort: a malformed blob degrades to null (legacy look)
  // rather than dropping the whole pack.
  const options = parseJsonField<StudyPackOptions | null>(row.options_json, row.id, 'options_json', null)
  if (!flashcards.ok || !quiz.ok || !keyConcepts.ok) {
    return null
  }
  return {
    id: row.id,
    documentId: row.document_id,
    title: row.title,
    summary: row.summary,
    flashcards: flashcards.value,
    quiz: quiz.value,
    keyConcepts: keyConcepts.value,
    options: options.ok ? options.value : null,
    createdAt: row.created_at
  }
}

export interface CreateStudyPackInput {
  documentId: string
  title: string
  summary: string | null
  flashcards: Flashcard[]
  quiz: QuizQuestion[]
  keyConcepts: string[]
  options: StudyPackOptions | null
}

export function insertStudyPack(input: CreateStudyPackInput): StudyPackRecord {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO study_packs (
        id, document_id, title, summary, flashcards_json, quiz_json,
        key_concepts_json, options_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.documentId,
      input.title,
      input.summary,
      JSON.stringify(input.flashcards),
      JSON.stringify(input.quiz),
      JSON.stringify(input.keyConcepts),
      input.options ? JSON.stringify(input.options) : null,
      createdAt
    )
  return {
    id,
    documentId: input.documentId,
    title: input.title,
    summary: input.summary,
    flashcards: input.flashcards,
    quiz: input.quiz,
    keyConcepts: input.keyConcepts,
    options: input.options,
    createdAt
  }
}

export function getLatestStudyPackForDocument(documentId: string): StudyPackRecord | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM study_packs
       WHERE document_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(documentId) as StudyPackRow | undefined
  if (!row) return null
  return toRecord(row)
}

// All packs for a document, newest first — powers the history switcher. Packs
// whose JSON is corrupt are skipped rather than failing the whole list.
export function listStudyPacksForDocument(documentId: string): StudyPackRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM study_packs WHERE document_id = ? ORDER BY created_at DESC`)
    .all(documentId) as StudyPackRow[]
  return rows.map(toRecord).filter((r): r is StudyPackRecord => r !== null)
}

export function getStudyPackById(id: string): StudyPackRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM study_packs WHERE id = ?`)
    .get(id) as StudyPackRow | undefined
  if (!row) return null
  return toRecord(row)
}

export function deleteStudyPack(id: string): void {
  getDb().prepare(`DELETE FROM study_packs WHERE id = ?`).run(id)
}
