// Detect and persist a document's genre at import. Best-effort and synchronous
// (detection is cheap/pure); a failure must never break import. The user can
// override the stored genre later.

import type { ExtractedDocument } from '@shared/types/database'
import { setDocumentGenre } from '../../db/repositories/documentRepository'
import { detectGenre } from './genreDetector'

export function classifyAndStoreGenre(documentId: string, extracted: ExtractedDocument): void {
  try {
    const genre = detectGenre(extracted)
    if (genre) setDocumentGenre(documentId, genre)
  } catch (err) {
    console.warn('[fuzzy] genre detection failed', err)
  }
}
