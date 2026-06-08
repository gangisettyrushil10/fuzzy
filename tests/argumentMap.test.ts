import { describe, it, expect } from 'vitest'
import {
  buildLocalArgumentMap,
  extractClaimSentences
} from '../src/main/services/argument/argumentMapMock'
import type { CitationFormat } from '../src/shared/types/database'

const citationsFor = (page: number): Record<CitationFormat, string> => ({
  mla: `p${page}`,
  apa: 'APA',
  chicago: 'Chicago',
  harvard: 'Harvard'
})

const PAGES = [
  {
    pageNumber: 1,
    textContent:
      'The author argues that surveillance erodes autonomy because constant observation changes behavior. ' +
      'The weather was nice that day. ' +
      'Therefore, privacy must be protected as a fundamental right of every citizen.'
  }
]

describe('extractClaimSentences', () => {
  it('keeps assertive cue sentences and drops non-claims', () => {
    const claims = extractClaimSentences(PAGES)
    const text = claims.map((c) => c.sentence).join(' | ')
    expect(text).toContain('argues that surveillance')
    expect(text).toContain('privacy must be protected')
    expect(text).not.toContain('weather was nice')
  })
})

describe('buildLocalArgumentMap', () => {
  it('builds a thesis + cited claims, assessing support', () => {
    const map = buildLocalArgumentMap({
      documentId: 'd',
      documentTitle: 'Doc',
      pages: PAGES,
      citationsFor,
      fallbackReason: 'no_api_key'
    })
    expect(map.thesis).toContain('argues that surveillance')
    expect(map.claims.length).toBeGreaterThanOrEqual(2)
    // Support carries the injected real citation.
    expect(map.claims[0].support[0].citations.mla).toBe('p1')
    // "because" marks the first claim well-supported; the "must/therefore" one asserted.
    const supported = map.claims.find((c) => c.claim.includes('surveillance'))
    expect(supported?.assessment).toBe('well-supported')
    expect(map.fallbackReason).toBe('no_api_key')
  })

  it('handles documents with no detectable claims', () => {
    const map = buildLocalArgumentMap({
      documentId: 'd',
      documentTitle: 'Doc',
      pages: [{ pageNumber: 1, textContent: 'A calm river. Birds flew over the hills at dawn.' }],
      citationsFor,
      fallbackReason: null
    })
    expect(map.claims).toEqual([])
    expect(map.thesis).toBe('')
  })
})
