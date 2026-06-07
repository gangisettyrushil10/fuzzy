// "Ctrl-F for tone": rank a document's passages by how strongly their diction
// evokes a mood. Fully local (the affect lexicon) — zero API cost. Returns
// RankedPassage-shaped results so click-to-jump works unchanged.

import type { DocumentRecord, ToneMatch, ToneSearchRequest, ToneSearchResult } from '@shared/types/database'
import { getDocument } from '../../db/repositories/documentRepository'
import { listPagesForDocument } from '../../db/repositories/pageRepository'
import { segmentIntoChunks } from '../thesis/textSegmentation'
import { formatAllCitations, type CitationSource } from '../thesis/citationFormatter'
import { resolveTone, scoreText } from './toneLexicon'

function citationSource(doc: DocumentRecord): CitationSource {
  return { title: doc.title, author: doc.author, year: doc.year, publisher: doc.publisher }
}

export function runToneSearch(request: ToneSearchRequest): ToneSearchResult {
  const limit = Math.min(Math.max(request.limit ?? 15, 1), 50)
  const doc = getDocument(request.documentId)
  const { tone, words } = resolveTone(request.tone)
  if (!doc || words.length === 0) {
    return { tone, documentId: request.documentId, passages: [] }
  }

  const matches: ToneMatch[] = []
  for (const page of listPagesForDocument(request.documentId)) {
    const text = page.textContent
    if (!text || !text.trim()) continue
    for (const chunk of segmentIntoChunks(text)) {
      const { score, matched } = scoreText(chunk.text, words)
      if (score <= 0) continue
      matches.push({
        id: `${request.documentId}:${page.pageNumber}:${chunk.index}`,
        documentId: request.documentId,
        documentTitle: doc.title,
        pageNumber: page.pageNumber,
        snippet: chunk.text,
        score,
        citations: formatAllCitations(citationSource(doc), page.pageNumber),
        matchedWords: matched
      })
    }
  }

  matches.sort((a, b) => b.score - a.score)
  return { tone, documentId: request.documentId, passages: matches.slice(0, limit) }
}
