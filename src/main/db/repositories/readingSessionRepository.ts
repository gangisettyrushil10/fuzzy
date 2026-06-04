import { randomUUID } from 'crypto'
import { getDb } from '../../services/dbService'
import type { ReadingPlan, ReadingSessionRecord } from '@shared/types/database'

interface ReadingSessionRow {
  id: string
  document_id: string
  available_minutes: number
  estimated_minutes: number
  plan_json: string
  created_at: string
}

function toRecord(row: ReadingSessionRow): ReadingSessionRecord | null {
  let plan: ReadingPlan
  try {
    plan = JSON.parse(row.plan_json)
  } catch (err) {
    console.error(`[fuzzy db] malformed JSON in reading_sessions.plan_json for id=${row.id}`, err)
    return null
  }
  return {
    id: row.id,
    documentId: row.document_id,
    availableMinutes: row.available_minutes,
    estimatedMinutes: row.estimated_minutes,
    plan,
    createdAt: row.created_at
  }
}

export interface CreateReadingSessionInput {
  documentId: string
  availableMinutes: number
  estimatedMinutes: number
  plan: ReadingPlan
}

export function insertReadingSession(input: CreateReadingSessionInput): ReadingSessionRecord {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO reading_sessions (
        id, document_id, available_minutes, estimated_minutes, plan_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.documentId,
      input.availableMinutes,
      input.estimatedMinutes,
      JSON.stringify(input.plan),
      createdAt
    )
  return {
    id,
    documentId: input.documentId,
    availableMinutes: input.availableMinutes,
    estimatedMinutes: input.estimatedMinutes,
    plan: input.plan,
    createdAt
  }
}

export function getLatestSessionForDocument(documentId: string): ReadingSessionRecord | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM reading_sessions
       WHERE document_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(documentId) as ReadingSessionRow | undefined
  if (!row) return null
  return toRecord(row)
}
