// Orchestrates the entity/structure index built at import. Default path is the
// pure, zero-cost local NER (entityExtractorMock); an optional LLM roster
// refinement can upgrade quality later (gated behind a key + setting — left as a
// future opt-in so a plain import never spends the user's key).

import type { ExtractedDocument } from '@shared/types/database'
import { buildLocalEntityIndex, isLikelyFiction } from './entityExtractorMock'
import { refineCharacterRoster } from './entityRefine'
import { hasEntities, replaceEntityIndex } from '../../db/repositories/entityRepository'
import { listPagesForDocument } from '../../db/repositories/pageRepository'

// Build (or rebuild) the character index for a document. Best-effort and
// idempotent — safe to call from the background import path. Returns the number
// of entities indexed (0 when skipped). The local proper-noun pass runs first;
// an optional AI refine then drops non-people (spells/places/objects) when a key
// is configured (falls back to the local roster on any failure).
export async function buildEntityIndex(
  documentId: string,
  extracted: ExtractedDocument,
  opts: { force?: boolean } = {}
): Promise<number> {
  if (extracted.pages.length === 0) return 0
  // Skip if already indexed (re-import / re-open) unless forced.
  if (!opts.force && hasEntities(documentId)) return 0
  // Genre gate: only run character extraction on fiction-like prose, so the
  // roster never fills non-fiction with spurious "characters".
  if (!isLikelyFiction(extracted)) return 0

  const local = buildLocalEntityIndex(
    extracted.pages.map((p) => ({ pageNumber: p.pageNumber, textContent: p.textContent }))
  )
  if (local.length === 0) return 0

  const { entities, refined } = await refineCharacterRoster(local)
  replaceEntityIndex(documentId, entities, 'character', refined ? 'llm' : 'local')
  return entities.length
}

// Explicit rebuild for an already-imported document: re-extract from the stored
// page text and AI-refine. Used by the "Refine cast" action so existing books
// get a cleaned roster without a re-import. Returns the new entity count.
export async function rebuildEntityIndex(documentId: string): Promise<number> {
  const pages = listPagesForDocument(documentId).map((p) => ({
    pageNumber: p.pageNumber,
    textContent: p.textContent
  }))
  if (pages.length === 0) return 0

  const local = buildLocalEntityIndex(pages)
  if (local.length === 0) return 0

  const { entities, refined } = await refineCharacterRoster(local)
  replaceEntityIndex(documentId, entities, 'character', refined ? 'llm' : 'local')
  return entities.length
}
