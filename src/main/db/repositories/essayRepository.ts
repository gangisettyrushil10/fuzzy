import { randomUUID } from 'crypto'
import { getDb } from '../../services/dbService'
import type { EssayOutline, EssayRecord, ThesisScope } from '@shared/types/database'

interface EssayRow {
  id: string
  title: string
  thesis: string
  scope: string
  outline_json: string | null
  draft_md: string
  created_at: string
  updated_at: string
}

function parseOutline(json: string | null): EssayOutline | null {
  if (!json) return null
  try {
    return JSON.parse(json) as EssayOutline
  } catch {
    return null
  }
}

function toRecord(row: EssayRow): EssayRecord {
  return {
    id: row.id,
    title: row.title,
    thesis: row.thesis,
    scope: row.scope === 'active' ? 'active' : 'library',
    outline: parseOutline(row.outline_json),
    draftMd: row.draft_md,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listEssays(): EssayRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM essays ORDER BY updated_at DESC`)
    .all() as EssayRow[]
  return rows.map(toRecord)
}

export function getEssay(id: string): EssayRecord | null {
  const row = getDb().prepare(`SELECT * FROM essays WHERE id = ?`).get(id) as EssayRow | undefined
  return row ? toRecord(row) : null
}

export function createEssay(title: string, thesis: string, scope: ThesisScope): EssayRecord {
  const id = randomUUID()
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO essays (id, title, thesis, scope, outline_json, draft_md, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, '', ?, ?)`
    )
    .run(id, title, thesis, scope, now, now)
  return getEssay(id)!
}

export interface EssayPatch {
  title?: string
  thesis?: string
  scope?: ThesisScope
  outline?: EssayOutline | null
  draftMd?: string
}

export function updateEssay(id: string, patch: EssayPatch): EssayRecord | null {
  const sets: string[] = []
  const values: Array<string | null> = []
  if (patch.title !== undefined) {
    sets.push('title = ?')
    values.push(patch.title)
  }
  if (patch.thesis !== undefined) {
    sets.push('thesis = ?')
    values.push(patch.thesis)
  }
  if (patch.scope !== undefined) {
    sets.push('scope = ?')
    values.push(patch.scope)
  }
  if (patch.outline !== undefined) {
    sets.push('outline_json = ?')
    values.push(patch.outline ? JSON.stringify(patch.outline) : null)
  }
  if (patch.draftMd !== undefined) {
    sets.push('draft_md = ?')
    values.push(patch.draftMd)
  }
  if (sets.length === 0) return getEssay(id)
  sets.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)
  getDb()
    .prepare(`UPDATE essays SET ${sets.join(', ')} WHERE id = ?`)
    .run(...values)
  return getEssay(id)
}

export function deleteEssay(id: string): void {
  getDb().prepare(`DELETE FROM essays WHERE id = ?`).run(id)
}
