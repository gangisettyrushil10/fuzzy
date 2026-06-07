import { describe, it, expect } from 'vitest'
import {
  assembleEvidence,
  decomposeQueryLocally,
  detectRelation,
  scoreCandidateLocally,
  validateQuoteSpan
} from '../src/main/services/evidence/evidenceMock'
import type { CitationFormat, EvidenceItem } from '../src/shared/types/database'

const cites = (): Record<CitationFormat, string> => ({
  mla: 'MLA-CITE',
  apa: 'APA',
  chicago: 'Chicago',
  harvard: 'Harvard'
})

describe('validateQuoteSpan (determinism guard)', () => {
  const window = 'Elizabeth blushed deeply.  “I cannot stop thinking of you,” said Darcy.'

  it('accepts a verbatim span (whitespace/quote tolerant) and returns the real substring', () => {
    const span = validateQuoteSpan(window, 'I cannot stop   thinking of you')
    expect(span).not.toBeNull()
    expect(span!.toLowerCase()).toContain('thinking of you')
  })

  it('rejects a paraphrase that is not actually in the window', () => {
    expect(validateQuoteSpan(window, 'Darcy confessed his enduring love')).toBeNull()
  })

  it('rejects too-short quotes', () => {
    expect(validateQuoteSpan(window, 'said')).toBeNull()
  })
})

describe('decomposeQueryLocally', () => {
  it('pulls roster names from the query and expands love signals', () => {
    const d = decomposeQueryLocally('find evidence that Elizabeth and Darcy are in love', [
      'Elizabeth',
      'Darcy',
      'Wickham'
    ])
    expect(d.entities).toEqual(expect.arrayContaining(['Elizabeth', 'Darcy']))
    expect(d.entities).not.toContain('Wickham')
    expect(d.relation).toBe('romantic love')
    expect(d.signalVocabulary.length).toBeGreaterThan(0)
  })
})

describe('detectRelation', () => {
  it('maps phrasing to a relation + signals', () => {
    expect(detectRelation('are they enemies?').relation).toBe('conflict')
    expect(detectRelation('something vague').relation).toBe('relationship')
  })
})

describe('scoreCandidateLocally', () => {
  const decomposition = {
    entities: ['Elizabeth', 'Darcy'],
    relation: 'romantic love',
    signalVocabulary: ['kiss', 'blush', 'longing']
  }

  it('rates a window with both entities and multiple signals as strong', () => {
    const v = scoreCandidateLocally('Elizabeth gave Darcy a longing look and a blush.', decomposition)
    expect(v?.strength).toBe('strong')
  })

  it('returns null when there is no signal', () => {
    expect(scoreCandidateLocally('The weather turned cold over the hills.', decomposition)).toBeNull()
  })
})

describe('assembleEvidence', () => {
  const item = (strength: EvidenceItem['strength'], page: number): EvidenceItem => ({
    id: `d:${page}:0`,
    documentId: 'd',
    documentTitle: 'Pride',
    pageNumber: page,
    snippet: 'a quote',
    score: 0.9,
    citations: cites(),
    strength,
    rationale: 'because'
  })

  it('groups items into sub-claims and preserves the real citations', () => {
    const r = assembleEvidence({
      query: 'q',
      documentId: 'd',
      decomposition: { entities: ['Elizabeth', 'Darcy'], relation: 'romantic love', signalVocabulary: [] },
      items: [item('strong', 1), item('weak', 2)],
      consideredCandidateCount: 5,
      fallbackReason: null
    })
    expect(r.subClaims.length).toBe(2) // direct + suggestive
    const allEvidence = r.subClaims.flatMap((s) => s.evidence)
    expect(allEvidence[0].citations.mla).toBe('MLA-CITE')
    expect(r.claim).toContain('Elizabeth and Darcy')
  })

  it('handles the empty case gracefully', () => {
    const r = assembleEvidence({
      query: 'q',
      documentId: 'd',
      decomposition: { entities: [], relation: 'romantic love', signalVocabulary: [] },
      items: [],
      consideredCandidateCount: 3,
      fallbackReason: 'no_api_key'
    })
    expect(r.subClaims).toEqual([])
    expect(r.claim.toLowerCase()).toContain('no clear evidence')
    expect(r.fallbackReason).toBe('no_api_key')
  })
})
