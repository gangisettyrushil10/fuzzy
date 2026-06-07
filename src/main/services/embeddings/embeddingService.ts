// Cached embeddings built once per document at import. Real OpenAI embeddings
// when a key is configured; deterministic pseudo-embeddings otherwise (so
// retrieval works offline). Hash + model guarded so re-indexing only re-embeds
// changed chunks, and a mock→real provider switch transparently re-embeds.

import OpenAI from 'openai'
import { createHash } from 'crypto'
import type { ExtractedDocument } from '@shared/types/database'
import { segmentIntoChunks } from '../thesis/textSegmentation'
import { getCachedMeta, bulkUpsertVectors, type UpsertVectorInput } from '../../db/repositories/embeddingRepository'
import { listDocuments } from '../../db/repositories/documentRepository'
import { listPagesForDocument } from '../../db/repositories/pageRepository'
import { resolveProviderMode } from '../ai/provider'
import { getDecryptedOpenaiKey, getOpenaiBaseUrl } from '../settingsService'
import { EMBED_DIM, MOCK_EMBED_MODEL, pseudoEmbed } from './embeddingMock'
import { LOCAL_EMBED_MODEL, embedLocalBatch, embedLocalOne } from './localEmbed'

const REAL_EMBED_MODEL = 'text-embedding-3-small'
const EMBED_BATCH = 96
const EMBED_TIMEOUT_MS = 60_000

type EmbedKind = 'local' | 'openai' | 'mock'

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

// Which embedding space this machine currently targets. The model id is stored
// per-vector so query-time embedding can match the stored space.
//
// Policy: prefer LOCAL embeddings (free, offline, real semantics) for everyone.
// Only use OpenAI's hosted embeddings when the user has explicitly pointed the
// app at the real OpenAI endpoint with a key — Groq (the default) has no
// embeddings API, so local is what makes semantic search work out of the box.
export function targetEmbedModel(): { model: string; kind: EmbedKind } {
  const baseUrl = getOpenaiBaseUrl()
  const onRealOpenAI = baseUrl === null || /\/\/api\.openai\.com/.test(baseUrl)
  if (resolveProviderMode().mode === 'openai' && onRealOpenAI && getDecryptedOpenaiKey()) {
    return { model: REAL_EMBED_MODEL, kind: 'openai' }
  }
  return { model: LOCAL_EMBED_MODEL, kind: 'local' }
}

function makeClient(): OpenAI | null {
  const key = getDecryptedOpenaiKey()
  if (!key) return null
  return new OpenAI({ apiKey: key, timeout: EMBED_TIMEOUT_MS, baseURL: getOpenaiBaseUrl() ?? undefined })
}

async function embedReal(client: OpenAI, texts: string[]): Promise<Float32Array[]> {
  const out: Float32Array[] = []
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH)
    const resp = await client.embeddings.create({
      model: REAL_EMBED_MODEL,
      input: batch,
      dimensions: EMBED_DIM
    })
    for (const item of resp.data) out.push(Float32Array.from(item.embedding))
  }
  return out
}

/**
 * Build (or refresh) the embedding cache for a document. Best-effort: on a real
 * embedding failure it leaves the cache unchanged and returns 0. Returns the
 * number of chunks (re)embedded.
 */
export async function buildEmbeddingIndex(
  documentId: string,
  extracted: ExtractedDocument
): Promise<number> {
  if (extracted.pages.length === 0) return 0
  const { model, kind } = targetEmbedModel()
  const cached = getCachedMeta(documentId)

  const pending: Array<{ id: string; pageNumber: number; chunkIndex: number; text: string; textHash: string }> = []
  for (const page of extracted.pages) {
    const text = page.textContent
    if (!text || !text.trim()) continue
    for (const chunk of segmentIntoChunks(text)) {
      const id = `${documentId}:${page.pageNumber}:${chunk.index}`
      const textHash = sha256(chunk.text)
      const meta = cached.get(id)
      if (meta && meta.textHash === textHash && meta.model === model) continue
      pending.push({ id, pageNumber: page.pageNumber, chunkIndex: chunk.index, text: chunk.text, textHash })
    }
  }
  if (pending.length === 0) return 0

  const texts = pending.map((p) => p.text)
  let vectors: Float32Array[]
  // The model id we actually store can differ from the target when local embed
  // is unavailable on a first offline run — we degrade to the deterministic mock
  // so retrieval still works, and the hash+model guard upgrades it to local on a
  // later run once the model is present.
  let storedModel = model
  if (kind === 'openai') {
    const client = makeClient()
    if (!client) return 0
    try {
      vectors = await embedReal(client, texts)
    } catch (err) {
      console.warn('[fuzzy] real embedding generation failed; cache unchanged', err)
      return 0
    }
  } else if (kind === 'local') {
    const local = await embedLocalBatch(texts)
    if (local) {
      vectors = local
    } else {
      vectors = texts.map((t) => pseudoEmbed(t))
      storedModel = MOCK_EMBED_MODEL
    }
  } else {
    vectors = texts.map((t) => pseudoEmbed(t))
    storedModel = MOCK_EMBED_MODEL
  }

  const rows: UpsertVectorInput[] = pending.map((p, i) => ({
    id: p.id,
    documentId,
    pageNumber: p.pageNumber,
    chunkIndex: p.chunkIndex,
    textHash: p.textHash,
    model: storedModel,
    vector: vectors[i]
  }))
  bulkUpsertVectors(rows)
  return rows.length
}

// Build embeddings for already-imported documents that are missing or stale
// (e.g. docs imported before embeddings existed, or after the embedding model
// changed). Idempotent: the per-chunk hash+model guard skips up-to-date chunks,
// so steady-state startups do no real work (and never load the model). Runs
// sequentially in the background; best-effort.
export async function backfillEmbeddings(): Promise<void> {
  let docs: ReturnType<typeof listDocuments>
  try {
    docs = listDocuments()
  } catch {
    return
  }
  for (const doc of docs) {
    try {
      const pages = listPagesForDocument(doc.id)
      if (pages.length === 0) continue
      const extracted: ExtractedDocument = {
        pageCount: pages.length,
        pages: pages.map((p) => ({
          pageNumber: p.pageNumber,
          textContent: p.textContent ?? '',
          estimatedWordCount: p.estimatedWordCount
        }))
      }
      const n = await buildEmbeddingIndex(doc.id, extracted)
      if (n > 0) console.log(`[fuzzy embed] backfilled ${n} chunks for "${doc.title}"`)
    } catch (err) {
      console.warn('[fuzzy embed] backfill failed for', doc.id, err)
    }
  }
}

/**
 * Embed a query into the SAME space as the stored vectors (caller passes the
 * stored model). Returns null when a real embedding is required but unavailable,
 * so callers can fall back to BM25-only retrieval.
 */
export async function embedQuery(text: string, model: string): Promise<Float32Array | null> {
  if (model === LOCAL_EMBED_MODEL) return embedLocalOne(text)
  if (model === MOCK_EMBED_MODEL) return pseudoEmbed(text)
  // OpenAI hosted embedding (only when vectors were built that way).
  const client = makeClient()
  if (!client) return null
  try {
    const [vec] = await embedReal(client, [text])
    return vec ?? null
  } catch (err) {
    console.warn('[fuzzy] query embedding failed; falling back to lexical', err)
    return null
  }
}
