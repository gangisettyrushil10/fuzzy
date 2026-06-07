// Orchestrates real library-wide lexical search for the Thesis Workspace:
// reconcile the index against the documents table (self-healing — new imports
// get added, deleted docs get pruned, with no external hooks), run BM25, then
// decorate hits with the document title + all-four-format citations and dedupe.

import {
  getDocument,
  listDocuments
} from '../../db/repositories/documentRepository'
import { listPagesForDocument } from '../../db/repositories/pageRepository'
import type {
  DocumentRecord,
  RankedPassage,
  ThesisSearchRequest,
  ThesisSearchResult
} from '@shared/types/database'
import { LexicalIndex, type IndexedChunk } from './lexicalIndex'
import { segmentIntoChunks, tokenizeForSearch } from './textSegmentation'
import { formatAllCitations, type CitationSource } from './citationFormatter'

const index = new LexicalIndex()

// Bring the index in line with the current documents table. Adds chunks for
// any document not yet indexed; drops any indexed document that no longer
// exists. Cheap after the first run (only new docs are tokenized).
function reconcileIndex(): number {
  const docs = listDocuments()
  const liveIds = new Set(docs.map((d) => d.id))

  for (const indexedId of index.indexedDocumentIds()) {
    if (!liveIds.has(indexedId)) index.removeDocument(indexedId)
  }

  for (const doc of docs) {
    if (index.hasDocument(doc.id)) continue
    const chunks: IndexedChunk[] = []
    for (const page of listPagesForDocument(doc.id)) {
      const text = page.textContent
      if (!text || !text.trim()) continue
      for (const chunk of segmentIntoChunks(text)) {
        const tokens = tokenizeForSearch(chunk.text)
        if (tokens.length === 0) continue
        chunks.push({
          id: `${doc.id}:${page.pageNumber}:${chunk.index}`,
          documentId: doc.id,
          pageNumber: page.pageNumber,
          chunkIndex: chunk.index,
          text: chunk.text,
          tokens
        })
      }
    }
    // addDocument records the doc even with zero chunks, so an un-indexed
    // (e.g. image-only) document isn't re-scanned on every search.
    index.addDocument(doc.id, chunks)
  }

  return docs.length
}

function citationSource(doc: DocumentRecord): CitationSource {
  return {
    title: doc.title,
    author: doc.author,
    year: doc.year,
    publisher: doc.publisher
  }
}

// Collapse near-identical snippets (same normalized text) so one quote doesn't
// appear many times from overlapping chunks.
function dedupe(passages: RankedPassage[]): RankedPassage[] {
  const seen = new Set<string>()
  const out: RankedPassage[] = []
  for (const p of passages) {
    const key = p.snippet.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

export function runThesisSearch(request: ThesisSearchRequest): ThesisSearchResult {
  const indexedDocumentCount = reconcileIndex()
  const limit = Math.min(Math.max(request.limit ?? 12, 1), 50)
  const queryTokens = tokenizeForSearch(request.thesis)

  if (queryTokens.length === 0) {
    return { query: request.thesis, scope: request.scope, indexedDocumentCount, passages: [] }
  }

  // Over-fetch so post-filtering (active scope) + dedupe still fill the limit.
  const scored = index.search(queryTokens, limit * 4)
  const maxScore = scored.length > 0 ? scored[0].score : 1

  const docCache = new Map<string, DocumentRecord | null>()
  const getDoc = (id: string): DocumentRecord | null => {
    if (!docCache.has(id)) docCache.set(id, getDocument(id))
    return docCache.get(id) ?? null
  }

  let passages: RankedPassage[] = []
  for (const { chunk, score } of scored) {
    if (request.scope === 'active' && chunk.documentId !== request.activeDocumentId) continue
    const doc = getDoc(chunk.documentId)
    if (!doc) continue
    passages.push({
      id: chunk.id,
      documentId: chunk.documentId,
      documentTitle: doc.title,
      pageNumber: chunk.pageNumber,
      snippet: chunk.text,
      score: maxScore > 0 ? Math.min(1, score / maxScore) : 0,
      citations: formatAllCitations(citationSource(doc), chunk.pageNumber)
    })
  }

  passages = dedupe(passages).slice(0, limit)

  return { query: request.thesis, scope: request.scope, indexedDocumentCount, passages }
}

// Exposed for tests / future explicit invalidation.
export function __resetThesisIndex(): void {
  for (const id of index.indexedDocumentIds()) index.removeDocument(id)
}
