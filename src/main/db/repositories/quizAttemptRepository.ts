import { randomUUID } from 'crypto'
import { getDb } from '../../services/dbService'
import type {
  QuizAttemptAnswer,
  QuizAttemptRecord,
  QuizAttemptStats
} from '@shared/types/database'

interface QuizAttemptRow {
  id: string
  study_pack_id: string
  document_id: string
  score: number
  total: number
  answers_json: string
  started_at: string
  completed_at: string
}

function toRecord(row: QuizAttemptRow): QuizAttemptRecord {
  let answers: QuizAttemptAnswer[] = []
  try {
    answers = JSON.parse(row.answers_json) as QuizAttemptAnswer[]
  } catch {
    answers = []
  }
  return {
    id: row.id,
    studyPackId: row.study_pack_id,
    documentId: row.document_id,
    score: row.score,
    total: row.total,
    answers,
    startedAt: row.started_at,
    completedAt: row.completed_at
  }
}

export interface CreateQuizAttemptInput {
  studyPackId: string
  documentId: string
  score: number
  total: number
  answers: QuizAttemptAnswer[]
  startedAt: string
}

export function insertQuizAttempt(input: CreateQuizAttemptInput): QuizAttemptRecord {
  const id = randomUUID()
  const completedAt = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO quiz_attempts (
        id, study_pack_id, document_id, score, total, answers_json,
        started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.studyPackId,
      input.documentId,
      input.score,
      input.total,
      JSON.stringify(input.answers),
      input.startedAt,
      completedAt
    )
  return {
    id,
    studyPackId: input.studyPackId,
    documentId: input.documentId,
    score: input.score,
    total: input.total,
    answers: input.answers,
    startedAt: input.startedAt,
    completedAt
  }
}

export function listQuizAttemptsForDocument(documentId: string): QuizAttemptRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM quiz_attempts WHERE document_id = ? ORDER BY completed_at DESC`)
    .all(documentId) as QuizAttemptRow[]
  return rows.map(toRecord)
}

export function getQuizAttemptStats(documentId: string): QuizAttemptStats {
  const rows = getDb()
    .prepare(
      `SELECT score, total, completed_at FROM quiz_attempts
       WHERE document_id = ? AND total > 0 ORDER BY completed_at DESC`
    )
    .all(documentId) as Array<{ score: number; total: number; completed_at: string }>
  if (rows.length === 0) return { attempts: 0, bestPct: 0, lastPct: 0 }
  const pcts = rows.map((r) => Math.round((r.score / r.total) * 100))
  return {
    attempts: rows.length,
    bestPct: Math.max(...pcts),
    lastPct: pcts[0] // rows are newest-first
  }
}
