import { describe, it, expect } from 'vitest'
import {
  buildLocalGlossary,
  extractDefinitions
} from '../src/main/services/glossary/glossaryMock'
import type { CitationFormat } from '../src/shared/types/database'

const citationsFor = (page: number): Record<CitationFormat, string> => ({
  mla: `p${page}`,
  apa: 'APA',
  chicago: 'Chicago',
  harvard: 'Harvard'
})

const PAGES = [
  {
    pageNumber: 2,
    textContent:
      'Photosynthesis is defined as the process by which plants convert light into chemical energy. ' +
      'The morning was bright and clear. ' +
      'Entropy refers to the degree of disorder in a thermodynamic system.'
  }
]

describe('extractDefinitions', () => {
  it('captures "is defined as" and "refers to" patterns and skips prose', () => {
    const defs = extractDefinitions(PAGES)
    const terms = defs.map((d) => d.term.toLowerCase())
    expect(terms).toContain('photosynthesis')
    expect(terms).toContain('entropy')
    expect(defs.every((d) => !d.term.toLowerCase().includes('morning'))).toBe(true)
  })

  it('does not duplicate the same term', () => {
    const dup = [
      { pageNumber: 1, textContent: 'Force is defined as mass times acceleration.' },
      { pageNumber: 2, textContent: 'Force is defined as a push or a pull on an object.' }
    ]
    const defs = extractDefinitions(dup)
    expect(defs.filter((d) => d.term.toLowerCase() === 'force')).toHaveLength(1)
  })
})

describe('buildLocalGlossary', () => {
  it('builds alphabetized terms with injected citations + verbatim source', () => {
    const g = buildLocalGlossary({
      documentId: 'd',
      pages: PAGES,
      citationsFor,
      fallbackReason: 'no_api_key'
    })
    expect(g.terms.length).toBeGreaterThanOrEqual(2)
    // Alphabetized: Entropy before Photosynthesis.
    expect(g.terms[0].term.toLowerCase()).toBe('entropy')
    expect(g.terms[0].citations.mla).toBe('p2')
    expect(g.terms[0].sourceQuote).toContain('Entropy refers to')
    expect(g.fallbackReason).toBe('no_api_key')
  })

  it('returns no terms for prose without definitions', () => {
    const g = buildLocalGlossary({
      documentId: 'd',
      pages: [{ pageNumber: 1, textContent: 'The river was calm. Birds flew over the hills.' }],
      citationsFor,
      fallbackReason: null
    })
    expect(g.terms).toEqual([])
  })
})
