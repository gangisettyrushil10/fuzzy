import { randomUUID } from 'crypto'
import { getDb } from '../../services/dbService'
import type { EntityKind, EntityMention, EntityRecord, ExtractedEntity } from '@shared/types/database'

interface EntityRow {
  id: string
  document_id: string
  kind: string
  name: string
  normalized_name: string
  aliases_json: string
  mention_count: number
  first_page: number | null
  salience: number
  source: string
  created_at: string
}

function toRecord(row: EntityRow): EntityRecord {
  let aliases: string[] = []
  try {
    const parsed = JSON.parse(row.aliases_json)
    if (Array.isArray(parsed)) aliases = parsed.filter((a): a is string => typeof a === 'string')
  } catch {
    aliases = []
  }
  return {
    id: row.id,
    documentId: row.document_id,
    kind: (row.kind as EntityKind) ?? 'character',
    name: row.name,
    normalizedName: row.normalized_name,
    aliases,
    mentionCount: row.mention_count,
    firstPage: row.first_page,
    salience: row.salience,
    source: row.source === 'llm' ? 'llm' : 'local',
    createdAt: row.created_at
  }
}

export function hasEntities(documentId: string): boolean {
  const row = getDb()
    .prepare(`SELECT 1 FROM entities WHERE document_id = ? LIMIT 1`)
    .get(documentId)
  return !!row
}

// Replace the whole entity index for a document in one transaction (delete then
// insert) so re-indexing is idempotent. Mirrors bulkUpsertPages's single-fsync
// discipline.
export function replaceEntityIndex(
  documentId: string,
  entities: ExtractedEntity[],
  kind: EntityKind = 'character',
  source: 'local' | 'llm' = 'local'
): void {
  const db = getDb()
  const delMentions = db.prepare(`DELETE FROM entity_mentions WHERE document_id = ? AND entity_id IN (SELECT id FROM entities WHERE document_id = ? AND kind = ?)`)
  const delEntities = db.prepare(`DELETE FROM entities WHERE document_id = ? AND kind = ?`)
  const insEntity = db.prepare(
    `INSERT INTO entities (id, document_id, kind, name, normalized_name, aliases_json,
        mention_count, first_page, salience, source, attributes_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?)`
  )
  const insMention = db.prepare(
    `INSERT INTO entity_mentions (id, entity_id, document_id, page_number, surface_form, count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(entity_id, page_number) DO UPDATE SET count = count + excluded.count`
  )

  const run = db.transaction((items: ExtractedEntity[]) => {
    const createdAt = new Date().toISOString()
    delMentions.run(documentId, documentId, kind)
    delEntities.run(documentId, kind)
    for (const e of items) {
      const entityId = randomUUID()
      insEntity.run(
        entityId,
        documentId,
        kind,
        e.name,
        e.normalizedName,
        JSON.stringify(e.aliases),
        e.mentionCount,
        e.firstPage,
        e.salience,
        source,
        createdAt
      )
      for (const m of e.mentions) {
        insMention.run(randomUUID(), entityId, documentId, m.pageNumber, m.surfaceForm, m.count, createdAt)
      }
    }
  })
  run(entities)
}

export function listEntities(documentId: string, kind: EntityKind = 'character'): EntityRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM entities WHERE document_id = ? AND kind = ? ORDER BY salience DESC, mention_count DESC`
    )
    .all(documentId, kind) as EntityRow[]
  return rows.map(toRecord)
}

// Resolve free-text names (from a query or @-mention) to entities. Matches a
// name against canonical normalized_name and aliases, case-insensitively, by
// substring either direction so "Darcy" finds "Mr. Darcy".
export function findEntitiesByNames(
  documentId: string,
  names: string[],
  kind: EntityKind = 'character'
): EntityRecord[] {
  if (names.length === 0) return []
  const all = listEntities(documentId, kind)
  const wanted = names.map((n) => n.toLowerCase().trim()).filter(Boolean)
  const matched: EntityRecord[] = []
  for (const want of wanted) {
    let best: EntityRecord | null = null
    for (const e of all) {
      const haystack = [e.normalizedName, ...e.aliases.map((a) => a.toLowerCase())]
      const hit = haystack.some((h) => h === want || h.includes(want) || want.includes(h))
      if (hit && (!best || e.salience > best.salience)) best = e
    }
    if (best && !matched.some((m) => m.id === best!.id)) matched.push(best)
  }
  return matched
}

// Pages where BOTH entities are mentioned — an index-only self-join. The cheap
// candidate filter that makes relationship evidence search tractable.
export function findCoMentionPages(documentId: string, entityIdA: string, entityIdB: string): number[] {
  const rows = getDb()
    .prepare(
      `SELECT a.page_number AS page_number
         FROM entity_mentions a
         JOIN entity_mentions b
           ON a.document_id = b.document_id AND a.page_number = b.page_number
        WHERE a.document_id = ? AND a.entity_id = ? AND b.entity_id = ?
        ORDER BY a.page_number ASC`
    )
    .all(documentId, entityIdA, entityIdB) as Array<{ page_number: number }>
  return rows.map((r) => r.page_number)
}

// Pages where an entity is mentioned (for single-entity + signal windows and the
// "track this character" jump-list).
export function getMentionPages(entityId: string): number[] {
  const rows = getDb()
    .prepare(`SELECT page_number FROM entity_mentions WHERE entity_id = ? ORDER BY page_number ASC`)
    .all(entityId) as Array<{ page_number: number }>
  return rows.map((r) => r.page_number)
}

export function getEntityMentions(entityId: string): EntityMention[] {
  const rows = getDb()
    .prepare(
      `SELECT page_number, surface_form, count FROM entity_mentions WHERE entity_id = ? ORDER BY page_number ASC`
    )
    .all(entityId) as Array<{ page_number: number; surface_form: string; count: number }>
  return rows.map((r) => ({ pageNumber: r.page_number, surfaceForm: r.surface_form, count: r.count }))
}
