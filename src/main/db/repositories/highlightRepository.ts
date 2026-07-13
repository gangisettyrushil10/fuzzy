import { createHash, randomUUID } from 'crypto'
import { getDb } from '../../services/dbService'
import { initialReviewState, scheduleNext } from '../../services/study/spacedRepetition'
import type {
  CreateHighlightInput,
  HighlightRecord,
  HighlightSearchInput,
  HighlightStats,
  HighlightSourceKind,
  ReviewGrade,
  UpdateHighlightInput
} from '@shared/types/database'

interface HighlightRow {
  id: string
  source_kind: HighlightSourceKind
  content_kind: HighlightRecord['contentKind']
  source_label: string
  source_title: string
  source_author: string | null
  source_url: string | null
  source_location: string | null
  external_id: string | null
  text: string
  note: string
  tags_json: string
  is_favorite: number
  metadata_json: string
  dedupe_hash: string
  ease: number
  interval_days: number
  repetitions: number
  due_at: string
  last_reviewed_at: string | null
  highlighted_at: string
  created_at: string
  updated_at: string
}

const SEARCH_LIMIT_DEFAULT = 200
const SEARCH_LIMIT_MAX = 1000

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return SEARCH_LIMIT_DEFAULT
  return Math.max(1, Math.min(SEARCH_LIMIT_MAX, Math.round(limit!)))
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const trimmed = String(raw ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 40)
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

function normalizeMetadata(metadata: Record<string, string> | undefined): Record<string, string> {
  if (!metadata || typeof metadata !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(metadata)) {
    const k = key.trim().slice(0, 48)
    const v = String(value ?? '')
      .trim()
      .slice(0, 300)
    if (!k || !v) continue
    out[k] = v
  }
  return out
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function toRecord(row: HighlightRow): HighlightRecord {
  return {
    id: row.id,
    sourceKind: row.source_kind,
    contentKind: row.content_kind,
    sourceLabel: row.source_label,
    sourceTitle: row.source_title,
    sourceAuthor: row.source_author,
    sourceUrl: row.source_url,
    sourceLocation: row.source_location,
    externalId: row.external_id,
    text: row.text,
    note: row.note,
    tags: safeJsonParse<string[]>(row.tags_json, []),
    isFavorite: row.is_favorite === 1,
    metadata: safeJsonParse<Record<string, string>>(row.metadata_json, {}),
    highlightedAt: row.highlighted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    review: {
      ease: row.ease,
      intervalDays: row.interval_days,
      repetitions: row.repetitions,
      dueAt: row.due_at,
      lastReviewedAt: row.last_reviewed_at
    }
  }
}

function dedupeHashOf(input: {
  sourceKind: string
  sourceTitle: string
  sourceLocation?: string | null
  externalId?: string | null
  text: string
}): string {
  return createHash('sha256')
    .update(
      [
        input.sourceKind,
        input.sourceTitle.trim().toLowerCase(),
        input.sourceLocation?.trim().toLowerCase() ?? '',
        input.externalId?.trim().toLowerCase() ?? '',
        input.text.trim()
      ].join('\u0000')
    )
    .digest('hex')
}

function syncFts(record: HighlightRecord): void {
  const db = getDb()
  db.prepare(`DELETE FROM highlights_fts WHERE highlight_id = ?`).run(record.id)
  db.prepare(
    `INSERT INTO highlights_fts (
      highlight_id, source_title, source_author, text, note, tags, source_label
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    record.id,
    record.sourceTitle,
    record.sourceAuthor,
    record.text,
    record.note,
    record.tags.join(' '),
    record.sourceLabel
  )
}

function deleteFts(id: string): void {
  getDb().prepare(`DELETE FROM highlights_fts WHERE highlight_id = ?`).run(id)
}

export function getHighlightById(id: string): HighlightRecord | null {
  const row = getDb().prepare(`SELECT * FROM highlights WHERE id = ?`).get(id) as
    | HighlightRow
    | undefined
  return row ? toRecord(row) : null
}

function insertHighlightInternal(input: CreateHighlightInput): HighlightRecord | null {
  const now = new Date()
  const highlightedAt = input.highlightedAt ?? now.toISOString()
  const review = initialReviewState(new Date(highlightedAt))
  const dedupeHash = dedupeHashOf({
    sourceKind: input.sourceKind,
    sourceTitle: input.sourceTitle,
    sourceLocation: input.sourceLocation ?? null,
    externalId: input.externalId ?? null,
    text: input.text
  })
  const tags = normalizeTags(input.tags)
  const metadata = normalizeMetadata(input.metadata)
  const id = randomUUID()
  const createdAt = now.toISOString()
  const info = getDb()
    .prepare(
      `INSERT OR IGNORE INTO highlights (
        id, source_kind, content_kind, source_label, source_title, source_author,
        source_url, source_location, external_id, text, note, tags_json,
        is_favorite, metadata_json, dedupe_hash, ease, interval_days,
        repetitions, due_at, last_reviewed_at, highlighted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.sourceKind,
      input.contentKind ?? 'other',
      (input.sourceLabel?.trim() || input.sourceKind.replace(/_/g, ' ')).slice(0, 80),
      input.sourceTitle.trim().slice(0, 240),
      input.sourceAuthor?.trim().slice(0, 160) ?? null,
      input.sourceUrl?.trim().slice(0, 600) ?? null,
      input.sourceLocation?.trim().slice(0, 120) ?? null,
      input.externalId?.trim().slice(0, 120) ?? null,
      input.text.trim().slice(0, 10_000),
      input.note?.trim().slice(0, 4_000) ?? '',
      JSON.stringify(tags),
      input.isFavorite ? 1 : 0,
      JSON.stringify(metadata),
      dedupeHash,
      review.ease,
      review.intervalDays,
      review.repetitions,
      review.dueAt,
      review.lastReviewedAt,
      highlightedAt,
      createdAt,
      createdAt
    )

  if (info.changes === 0) return null
  const record = getHighlightById(id)
  if (record) syncFts(record)
  return record
}

export function createHighlight(input: CreateHighlightInput): HighlightRecord {
  const record = insertHighlightInternal(input)
  if (record) return record
  const dedupeHash = dedupeHashOf({
    sourceKind: input.sourceKind,
    sourceTitle: input.sourceTitle,
    sourceLocation: input.sourceLocation ?? null,
    externalId: input.externalId ?? null,
    text: input.text
  })
  const row = getDb().prepare(`SELECT id FROM highlights WHERE dedupe_hash = ?`).get(dedupeHash) as
    | { id: string }
    | undefined
  const existing = row ? getHighlightById(row.id) : null
  if (existing) return existing
  throw new Error('Could not create highlight.')
}

export function importHighlightsBatch(
  sourceKind: HighlightSourceKind,
  sourceLabel: string,
  items: CreateHighlightInput[]
): { importedCount: number; dedupedCount: number } {
  let importedCount = 0
  let dedupedCount = 0
  const run = getDb().transaction((batch: CreateHighlightInput[]) => {
    for (const item of batch) {
      const record = insertHighlightInternal({
        ...item,
        sourceKind,
        sourceLabel: item.sourceLabel ?? sourceLabel
      })
      if (record) importedCount += 1
      else dedupedCount += 1
    }
  })
  run(items)
  return { importedCount, dedupedCount }
}

function buildFtsQuery(query: string): string {
  const tokens = query
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}\-_]/gu, '').trim())
    .filter(Boolean)
  if (tokens.length === 0) return ''
  return tokens.map((token) => `"${token.replace(/"/g, '""')}"*`).join(' AND ')
}

export function listHighlights(filters: HighlightSearchInput = {}): HighlightRecord[] {
  const params: Array<string | number> = []
  const where: string[] = []
  let sql = `SELECT h.* FROM highlights h`
  const query = typeof filters.query === 'string' ? filters.query : ''
  const fts = buildFtsQuery(query)
  if (fts) {
    sql += ` JOIN highlights_fts hf ON hf.highlight_id = h.id`
    where.push(`highlights_fts MATCH ?`)
    params.push(fts)
  }
  if (filters.favoritesOnly) where.push(`h.is_favorite = 1`)
  const nowIso = new Date().toISOString()
  if (filters.dueOnly) {
    where.push(`datetime(h.due_at) <= datetime(?)`)
    params.push(nowIso)
  }
  if (Array.isArray(filters.sourceKinds) && filters.sourceKinds.length > 0) {
    where.push(`h.source_kind IN (${filters.sourceKinds.map(() => '?').join(', ')})`)
    params.push(...filters.sourceKinds)
  }
  const tags = normalizeTags(filters.tags)
  for (const tag of tags) {
    where.push(`LOWER(h.tags_json) LIKE ?`)
    params.push(`%"${tag.toLowerCase()}"%`)
  }
  if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`
  sql += ` ORDER BY CASE WHEN datetime(h.due_at) <= datetime(?) THEN 0 ELSE 1 END, datetime(h.highlighted_at) DESC`
  params.push(nowIso)
  sql += ` LIMIT ?`
  params.push(clampLimit(filters.limit))
  const rows = getDb()
    .prepare(sql)
    .all(...params) as HighlightRow[]
  return rows.map(toRecord)
}

export function updateHighlight(id: string, patch: UpdateHighlightInput): HighlightRecord | null {
  const current = getHighlightById(id)
  if (!current) return null
  const next: HighlightRecord = {
    ...current,
    sourceTitle: patch.sourceTitle?.trim().slice(0, 240) ?? current.sourceTitle,
    sourceAuthor:
      patch.sourceAuthor === undefined
        ? current.sourceAuthor
        : patch.sourceAuthor?.trim().slice(0, 160) || null,
    sourceUrl:
      patch.sourceUrl === undefined
        ? current.sourceUrl
        : patch.sourceUrl?.trim().slice(0, 600) || null,
    sourceLocation:
      patch.sourceLocation === undefined
        ? current.sourceLocation
        : patch.sourceLocation?.trim().slice(0, 120) || null,
    text: patch.text?.trim().slice(0, 10_000) ?? current.text,
    note: patch.note?.trim().slice(0, 4_000) ?? current.note,
    tags: patch.tags ? normalizeTags(patch.tags) : current.tags,
    isFavorite: typeof patch.isFavorite === 'boolean' ? patch.isFavorite : current.isFavorite,
    updatedAt: new Date().toISOString()
  }

  getDb()
    .prepare(
      `UPDATE highlights
       SET source_title = ?, source_author = ?, source_url = ?, source_location = ?,
           text = ?, note = ?, tags_json = ?, is_favorite = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      next.sourceTitle,
      next.sourceAuthor,
      next.sourceUrl,
      next.sourceLocation,
      next.text,
      next.note,
      JSON.stringify(next.tags),
      next.isFavorite ? 1 : 0,
      next.updatedAt,
      id
    )
  syncFts(next)
  return getHighlightById(id)
}

export function deleteHighlight(id: string): void {
  deleteFts(id)
  getDb().prepare(`DELETE FROM highlights WHERE id = ?`).run(id)
}

export function gradeHighlight(id: string, grade: ReviewGrade): HighlightRecord | null {
  const current = getHighlightById(id)
  if (!current) return null
  const nextReview = scheduleNext(current.review, grade, new Date())
  getDb()
    .prepare(
      `UPDATE highlights
       SET ease = ?, interval_days = ?, repetitions = ?, due_at = ?, last_reviewed_at = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      nextReview.ease,
      nextReview.intervalDays,
      nextReview.repetitions,
      nextReview.dueAt,
      nextReview.lastReviewedAt,
      new Date().toISOString(),
      id
    )
  return getHighlightById(id)
}

export function listDueHighlights(nowIso: string, limit = 50): HighlightRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM highlights
       WHERE datetime(due_at) <= datetime(?)
       ORDER BY datetime(due_at) ASC, datetime(highlighted_at) DESC
       LIMIT ?`
    )
    .all(nowIso, clampLimit(limit)) as HighlightRow[]
  return rows.map(toRecord)
}

export function countDueHighlights(nowIso: string): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM highlights WHERE datetime(due_at) <= datetime(?)`)
    .get(nowIso) as { n: number } | undefined
  return row?.n ?? 0
}

export function getHighlightStats(nowIso: string): HighlightStats {
  const totals = getDb()
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) AS favorite_count,
         COUNT(DISTINCT source_title) AS source_count
       FROM highlights`
    )
    .get() as { total: number; favorite_count: number | null; source_count: number }
  const tagRows = getDb().prepare(`SELECT tags_json FROM highlights`).all() as Array<{
    tags_json: string
  }>
  const tagCounts = new Map<string, number>()
  for (const row of tagRows) {
    for (const tag of safeJsonParse<string[]>(row.tags_json, [])) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([tag]) => tag)
  return {
    total: totals.total ?? 0,
    dueCount: countDueHighlights(nowIso),
    favoriteCount: totals.favorite_count ?? 0,
    sourceCount: totals.source_count ?? 0,
    topTags
  }
}
