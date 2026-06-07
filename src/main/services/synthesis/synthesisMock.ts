import type {
  RankedPassage,
  SynthesisEvidence,
  SynthesisMode,
  SynthesisResult,
  SynthesisSubClaim
} from '@shared/types/database'

// Pure synthesis helpers — deterministic mock + shared mappers. Kept free of
// electron/openai imports so it unit-tests in the node env. synthesisService
// (which does touch settings/openai) re-uses these.

export function toEvidence(p: RankedPassage): SynthesisEvidence {
  return {
    quote: p.snippet,
    documentId: p.documentId,
    documentTitle: p.documentTitle,
    pageNumber: p.pageNumber,
    citations: p.citations
  }
}

export function groupByDocument(passages: RankedPassage[]): Map<string, RankedPassage[]> {
  const map = new Map<string, RankedPassage[]>()
  for (const p of passages) {
    const list = map.get(p.documentId)
    if (list) list.push(p)
    else map.set(p.documentId, [p])
  }
  return map
}

// Deterministic mock — groups the (real) gathered passages by source into
// sub-claims. Structurally identical to the real model output. `mode` flips the
// framing between the supporting case and the counter-case.
export function buildMockSynthesis(
  thesis: string,
  passages: RankedPassage[],
  mode: SynthesisMode = 'support'
): SynthesisResult {
  const counter = mode === 'counter'
  const groups = [...groupByDocument(passages).entries()]
  const subClaims: SynthesisSubClaim[] = groups.slice(0, 5).map(([, items]) => ({
    claim: counter
      ? `${items[0].documentTitle} can be read to challenge this thesis.`
      : `${items[0].documentTitle} offers support for this thesis.`,
    evidence: items.slice(0, 2).map(toEvidence)
  }))
  const tensions =
    groups.length >= 2
      ? [
          `Sources differ in emphasis — reconcile "${groups[0][1][0].documentTitle}" with "${groups[1][1][0].documentTitle}".`
        ]
      : []
  const verb = counter ? 'could be marshalled against' : 'broadly supports'
  const summary =
    passages.length === 0
      ? `No ${counter ? 'opposing' : 'supporting'} passages were found in your library for this thesis yet.`
      : `Across ${passages.length} passage(s) from ${groups.length} document(s), the gathered evidence ${verb} "${thesis}". (Offline mock — add an API key or base URL in Settings for a model-written ${counter ? 'rebuttal' : 'synthesis'}.)`
  return { thesis, subClaims, tensions, summary, consideredPassageCount: passages.length }
}
