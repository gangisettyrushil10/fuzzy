// Hybrid retrieval: fuse lexical BM25 with vector cosine via Reciprocal Rank
// Fusion (RRF). The shared semantic-search primitive for doc-scoped features
// (ask-the-book, spoiler-safe recall). Falls back to BM25-only when no vectors
// are cached or the query can't be embedded. The RRF helper is pure + reused by
// evidence retrieval.

import type { DocumentRecord, RankedPassage } from '@shared/types/database'
import { LexicalIndex, type IndexedChunk } from '../thesis/lexicalIndex'
import { segmentIntoChunks, tokenizeForSearch } from '../thesis/textSegmentation'
import { formatAllCitations, type CitationSource } from '../thesis/citationFormatter'
import { listPagesForDocument } from '../../db/repositories/pageRepository'
import { getDocument } from '../../db/repositories/documentRepository'
import { getVectors } from '../../db/repositories/embeddingRepository'
import { cosineSimilarity } from '../embeddings/embeddingMock'
import { embedQuery } from '../embeddings/embeddingService'
import { reciprocalRankFusion } from './rankFusion'

export { reciprocalRankFusion }

function citationSource(doc: DocumentRecord): CitationSource {
  return { title: doc.title, author: doc.author, year: doc.year, publisher: doc.publisher }
}

function buildDocChunks(documentId: string): IndexedChunk[] {
  const chunks: IndexedChunk[] = []
  for (const page of listPagesForDocument(documentId)) {
    const text = page.textContent
    if (!text || !text.trim()) continue
    for (const chunk of segmentIntoChunks(text)) {
      const tokens = tokenizeForSearch(chunk.text)
      if (tokens.length === 0) continue
      chunks.push({
        id: `${documentId}:${page.pageNumber}:${chunk.index}`,
        documentId,
        pageNumber: page.pageNumber,
        chunkIndex: chunk.index,
        text: chunk.text,
        tokens
      })
    }
  }
  return chunks
}

export interface HybridSearchOptions {
  limit?: number
  // Only consider pages <= maxPage (spoiler-safe recall).
  maxPage?: number | null
}

export async function hybridSearchDoc(
  documentId: string,
  query: string,
  opts: HybridSearchOptions = {}
): Promise<RankedPassage[]> {
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 50)
  const doc = getDocument(documentId)
  if (!doc) return []

  let chunks = buildDocChunks(documentId)
  if (opts.maxPage != null) chunks = chunks.filter((c) => c.pageNumber <= opts.maxPage!)
  if (chunks.length === 0) return []

  const byId = new Map(chunks.map((c) => [c.id, c]))

  // Lexical ranking.
  const index = new LexicalIndex()
  index.addDocument(documentId, chunks)
  const qTokens = tokenizeForSearch(query)
  const lexical = index.search(qTokens, limit * 4).map((s) => s.chunk.id)

  // Vector ranking (best-effort; same embedding space as the cached vectors).
  let vectorRanking: string[] = []
  const vectors = getVectors(documentId).filter((v) => byId.has(v.id))
  if (vectors.length > 0) {
    const qVec = await embedQuery(query, vectors[0].model)
    if (qVec) {
      vectorRanking = vectors
        .map((v) => ({ id: v.id, score: cosineSimilarity(qVec, v.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit * 4)
        .map((s) => s.id)
    }
  }

  const fused = reciprocalRankFusion([lexical, vectorRanking])
  if (fused.size === 0) return []
  const ranked = [...fused.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
  const maxScore = ranked[0][1] || 1

  const out: RankedPassage[] = []
  for (const [id, score] of ranked) {
    const chunk = byId.get(id)
    if (!chunk) continue
    out.push({
      id,
      documentId,
      documentTitle: doc.title,
      pageNumber: chunk.pageNumber,
      snippet: chunk.text,
      score: Math.min(1, score / maxScore),
      citations: formatAllCitations(citationSource(doc), chunk.pageNumber)
    })
  }
  return out
}
