import { getDb } from '../../services/dbService'

export interface CachedVector {
  id: string // `${documentId}:${pageNumber}:${chunkIndex}`
  documentId: string
  pageNumber: number
  chunkIndex: number
  textHash: string
  model: string
  vector: Float32Array
}

export interface UpsertVectorInput {
  id: string
  documentId: string
  pageNumber: number
  chunkIndex: number
  textHash: string
  model: string
  vector: Float32Array
}

function toBlob(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength)
}

function fromBlob(buf: Buffer): Float32Array {
  // Copy out of the (possibly pooled) Buffer so the view owns its bytes.
  const copy = Buffer.from(buf)
  return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4)
}

interface VectorRow {
  id: string
  document_id: string
  page_number: number
  chunk_index: number
  text_hash: string
  model: string
  vector: Buffer
}

export function hasVectors(documentId: string): boolean {
  const row = getDb()
    .prepare(`SELECT 1 FROM chunk_embeddings WHERE document_id = ? LIMIT 1`)
    .get(documentId)
  return !!row
}

// Per-chunk (text_hash, model) for the staleness skip: re-embed a chunk only
// when its text changed OR the target embedding model changed.
export function getCachedMeta(documentId: string): Map<string, { textHash: string; model: string }> {
  const rows = getDb()
    .prepare(`SELECT id, text_hash, model FROM chunk_embeddings WHERE document_id = ?`)
    .all(documentId) as Array<{ id: string; text_hash: string; model: string }>
  const map = new Map<string, { textHash: string; model: string }>()
  for (const r of rows) map.set(r.id, { textHash: r.text_hash, model: r.model })
  return map
}

export function getVectors(documentId: string): CachedVector[] {
  const rows = getDb()
    .prepare(
      `SELECT id, document_id, page_number, chunk_index, text_hash, model, vector
         FROM chunk_embeddings WHERE document_id = ?`
    )
    .all(documentId) as VectorRow[]
  return rows.map((r) => ({
    id: r.id,
    documentId: r.document_id,
    pageNumber: r.page_number,
    chunkIndex: r.chunk_index,
    textHash: r.text_hash,
    model: r.model,
    vector: fromBlob(r.vector)
  }))
}

export function bulkUpsertVectors(rows: UpsertVectorInput[]): void {
  if (rows.length === 0) return
  const db = getDb()
  const stmt = db.prepare(
    `INSERT INTO chunk_embeddings (id, document_id, page_number, chunk_index, text_hash, dim, vector, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       text_hash = excluded.text_hash,
       dim = excluded.dim,
       vector = excluded.vector,
       model = excluded.model,
       created_at = excluded.created_at`
  )
  const run = db.transaction((items: UpsertVectorInput[]) => {
    const createdAt = new Date().toISOString()
    for (const r of items) {
      stmt.run(
        r.id,
        r.documentId,
        r.pageNumber,
        r.chunkIndex,
        r.textHash,
        r.vector.length,
        toBlob(r.vector),
        r.model,
        createdAt
      )
    }
  })
  run(rows)
}
