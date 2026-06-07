// Pure evidence-search helpers (no electron/openai/db imports — unit-tested).
// Powers the no-key fallback for every stage and supplies the determinism guard
// (validateQuoteSpan) that the real LLM-judge path also depends on.

import type {
  EvidenceDecomposition,
  EvidenceItem,
  EvidenceSearchResult,
  EvidenceStrength,
  EvidenceSubClaim
} from '@shared/types/database'

// Relation → observable on-the-page signal vocabulary. `triggers` detect the
// relation from the query; `signals` expand retrieval beyond the literal word.
interface RelationEntry {
  relation: string
  triggers: string[]
  signals: string[]
}

const RELATION_LEXICON: RelationEntry[] = [
  {
    relation: 'romantic love',
    triggers: ['love', 'in love', 'romance', 'romantic', 'affection', 'attracted', 'courtship', 'lovers'],
    signals: [
      'kiss', 'kissed', 'embrace', 'embraced', 'blush', 'blushed', 'longing', 'tender',
      'beloved', 'heart', 'desire', 'passion', 'adore', 'adored', 'marry', 'marriage',
      'sweetheart', 'gaze', 'caress', 'whisper', 'beautiful', 'smile', 'devotion'
    ]
  },
  {
    relation: 'conflict',
    triggers: ['conflict', 'enemy', 'enemies', 'rivalry', 'rival', 'hate', 'hatred', 'feud', 'tension'],
    signals: [
      'anger', 'angry', 'shouted', 'glare', 'glared', 'struck', 'quarrel', 'despise',
      'furious', 'threat', 'accused', 'betray', 'betrayed', 'insult', 'rage', 'fought'
    ]
  },
  {
    relation: 'friendship',
    triggers: ['friend', 'friends', 'friendship', 'ally', 'allies', 'companionship', 'bond'],
    signals: ['laughed', 'together', 'helped', 'trust', 'loyal', 'companion', 'shared', 'comfort', 'support']
  },
  {
    relation: 'family',
    triggers: ['family', 'father', 'mother', 'brother', 'sister', 'son', 'daughter', 'related', 'relative'],
    signals: ['father', 'mother', 'brother', 'sister', 'son', 'daughter', 'blood', 'kin', 'inherit', 'household']
  }
]

export function detectRelation(query: string): { relation: string; signals: string[] } {
  const lower = query.toLowerCase()
  let best: RelationEntry | null = null
  let bestHits = 0
  for (const entry of RELATION_LEXICON) {
    const hits = entry.triggers.filter((t) => lower.includes(t)).length
    if (hits > bestHits) {
      best = entry
      bestHits = hits
    }
  }
  if (best) return { relation: best.relation, signals: best.signals }
  return { relation: 'relationship', signals: [] }
}

// Local query decomposition: pull entity names that appear in the query out of
// the document's roster, and expand the relation to its signal vocabulary.
export function decomposeQueryLocally(query: string, rosterNames: string[]): EvidenceDecomposition {
  const lower = query.toLowerCase()
  const entities: string[] = []
  for (const name of rosterNames) {
    const n = name.toLowerCase().trim()
    if (n && lower.includes(n) && !entities.some((e) => e.toLowerCase() === n)) entities.push(name)
  }
  const { relation, signals } = detectRelation(query)
  return { entities, relation, signalVocabulary: signals }
}

// Normalize for tolerant matching: unify quotes, collapse whitespace, lowercase.
function normalizeText(s: string): string {
  return s
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Same normalization, but tracks the original index of each normalized char so a
// match can be mapped back to the real substring.
function normalizeWithMap(s: string): { norm: string; map: number[] } {
  let out = ''
  const map: number[] = []
  let prevSpace = false
  let started = false
  for (let i = 0; i < s.length; i++) {
    let c = s[i]
    if ('“”„'.includes(c)) c = '"'
    else if ('‘’‚'.includes(c)) c = "'"
    if (/\s/.test(c)) {
      if (!started || prevSpace) continue
      prevSpace = true
      out += ' '
      map.push(i)
      continue
    }
    prevSpace = false
    started = true
    out += c.toLowerCase()
    map.push(i)
  }
  // Drop a trailing collapsed space.
  if (out.endsWith(' ')) {
    out = out.slice(0, -1)
    map.pop()
  }
  return { norm: out, map }
}

/**
 * The determinism guard: a model "quote" is accepted only if it is a real
 * (whitespace/quote-tolerant) substring of the window. Returns the matched
 * ORIGINAL substring (what gets stored as the snippet), or null to drop it.
 */
export function validateQuoteSpan(windowText: string, quote: string): string | null {
  const needle = normalizeText(quote)
  if (needle.length < 8) return null // too short to be meaningful evidence
  const { norm, map } = normalizeWithMap(windowText)
  const idx = norm.indexOf(needle)
  if (idx < 0) return null
  const startOrig = map[idx]
  const endOrig = map[idx + needle.length - 1] + 1
  return windowText.slice(startOrig, endOrig).trim()
}

export function strengthToScore(strength: EvidenceStrength): number {
  return strength === 'strong' ? 0.95 : strength === 'moderate' ? 0.7 : 0.4
}

function countHits(haystack: string, needles: string[]): number {
  let n = 0
  for (const needle of needles) {
    if (needle && haystack.includes(needle.toLowerCase())) n += 1
  }
  return n
}

/**
 * Local (no-LLM) verdict for a candidate window: how strongly does it evidence
 * the relation? Returns null when there's no real signal.
 */
export function scoreCandidateLocally(
  windowText: string,
  decomposition: EvidenceDecomposition
): { strength: EvidenceStrength } | null {
  const lower = windowText.toLowerCase()
  const entityHits = countHits(lower, decomposition.entities)
  const signalHits = countHits(lower, decomposition.signalVocabulary)

  if (entityHits >= 2 && signalHits >= 2) return { strength: 'strong' }
  if ((entityHits >= 1 && signalHits >= 2) || (entityHits >= 2 && signalHits >= 1))
    return { strength: 'moderate' }
  if (signalHits >= 1 && entityHits >= 1) return { strength: 'weak' }
  return null
}

const STRENGTH_RANK: Record<EvidenceStrength, number> = { strong: 3, moderate: 2, weak: 1 }

export interface AssembleEvidenceArgs {
  query: string
  documentId: string
  decomposition: EvidenceDecomposition
  items: EvidenceItem[]
  consideredCandidateCount: number
  fallbackReason: 'no_api_key' | null
}

// Group verified items into a cited claim with sub-claims, ordered by strength.
export function assembleEvidence(args: AssembleEvidenceArgs): EvidenceSearchResult {
  const { query, documentId, decomposition, items, consideredCandidateCount, fallbackReason } = args
  const sorted = [...items].sort(
    (a, b) => STRENGTH_RANK[b.strength] - STRENGTH_RANK[a.strength] || a.pageNumber - b.pageNumber
  )
  const subjects =
    decomposition.entities.length >= 2 ? ` between ${decomposition.entities.join(' and ')}` : ''

  if (sorted.length === 0) {
    return {
      query,
      documentId,
      decomposition,
      claim: `No clear evidence of ${decomposition.relation}${subjects} was found.`,
      subClaims: [],
      summary: `Considered ${consideredCandidateCount} candidate passage(s); none met the evidence bar.`,
      consideredCandidateCount,
      fallbackReason
    }
  }

  const direct = sorted.filter((i) => i.strength !== 'weak')
  const suggestive = sorted.filter((i) => i.strength === 'weak')
  const subClaims: EvidenceSubClaim[] = []
  if (direct.length > 0) subClaims.push({ claim: 'Direct textual evidence', evidence: direct })
  if (suggestive.length > 0) subClaims.push({ claim: 'Suggestive moments', evidence: suggestive })

  return {
    query,
    documentId,
    decomposition,
    claim: `The text supports ${decomposition.relation}${subjects}.`,
    subClaims,
    summary: `Found ${sorted.length} supporting passage(s) across ${
      new Set(sorted.map((i) => i.pageNumber)).size
    } page(s).`,
    consideredCandidateCount,
    fallbackReason
  }
}
