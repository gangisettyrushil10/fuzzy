import { randomUUID } from 'crypto'
import { getDb } from '../../services/dbService'
import type {
  FocusSessionProgress,
  FocusSessionRecord,
  StartFocusSessionInput
} from '@shared/types/database'

interface FocusSessionRow {
  id: string
  document_id: string
  started_at: string
  ended_at: string | null
  elapsed_seconds: number
  words_read: number
  wpm: number | null
  page_start: number | null
  page_end: number | null
  goal_type: string
  goal_target: number | null
  created_at: string
}

function toRecord(row: FocusSessionRow): FocusSessionRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    elapsedSeconds: row.elapsed_seconds,
    wordsRead: row.words_read,
    wpm: row.wpm,
    pageStart: row.page_start,
    pageEnd: row.page_end,
    goalType: (row.goal_type as FocusSessionRecord['goalType']) ?? 'none',
    goalTarget: row.goal_target,
    createdAt: row.created_at
  }
}

export function startFocusSession(input: StartFocusSessionInput): FocusSessionRecord {
  const id = randomUUID()
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO focus_sessions
       (id, document_id, started_at, ended_at, elapsed_seconds, words_read, wpm, page_start, page_end, goal_type, goal_target, created_at)
       VALUES (?, ?, ?, NULL, 0, 0, NULL, ?, ?, ?, ?, ?)`
    )
    .run(id, input.documentId, now, input.pageStart, input.pageStart, input.goalType, input.goalTarget, now)
  return {
    id,
    documentId: input.documentId,
    startedAt: now,
    endedAt: null,
    elapsedSeconds: 0,
    wordsRead: 0,
    wpm: null,
    pageStart: input.pageStart,
    pageEnd: input.pageStart,
    goalType: input.goalType,
    goalTarget: input.goalTarget,
    createdAt: now
  }
}

function computeWpm(elapsedSeconds: number, wordsRead: number): number | null {
  if (elapsedSeconds <= 0 || wordsRead <= 0) return null
  return Math.round(wordsRead / (elapsedSeconds / 60))
}

// Heartbeat update (session stays open).
export function updateFocusProgress(id: string, p: FocusSessionProgress): void {
  getDb()
    .prepare(
      `UPDATE focus_sessions SET elapsed_seconds = ?, words_read = ?, wpm = ?, page_end = ? WHERE id = ?`
    )
    .run(p.elapsedSeconds, p.wordsRead, computeWpm(p.elapsedSeconds, p.wordsRead), p.pageEnd, id)
}

// Finalize a session (sets ended_at).
export function endFocusSession(id: string, p: FocusSessionProgress): FocusSessionRecord | null {
  getDb()
    .prepare(
      `UPDATE focus_sessions
       SET elapsed_seconds = ?, words_read = ?, wpm = ?, page_end = ?, ended_at = ?
       WHERE id = ?`
    )
    .run(
      p.elapsedSeconds,
      p.wordsRead,
      computeWpm(p.elapsedSeconds, p.wordsRead),
      p.pageEnd,
      new Date().toISOString(),
      id
    )
  const row = getDb().prepare(`SELECT * FROM focus_sessions WHERE id = ?`).get(id) as
    | FocusSessionRow
    | undefined
  return row ? toRecord(row) : null
}

// Close any sessions left open by a crash/reload, using their last heartbeat.
export function finalizeOpenSessions(): void {
  getDb()
    .prepare(`UPDATE focus_sessions SET ended_at = ? WHERE ended_at IS NULL`)
    .run(new Date().toISOString())
}

export function listFocusSessions(limit = 500): FocusSessionRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM focus_sessions ORDER BY started_at DESC LIMIT ?`)
    .all(limit) as FocusSessionRow[]
  return rows.map(toRecord)
}
