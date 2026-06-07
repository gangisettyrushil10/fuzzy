import { describe, it, expect } from 'vitest'
import { buildMockSynthesis } from '../src/main/services/synthesis/synthesisMock'
import type { CitationFormat, RankedPassage } from '../src/shared/types/database'

const cites = (): Record<CitationFormat, string> => ({
  mla: 'MLA',
  apa: 'APA',
  chicago: 'Chicago',
  harvard: 'Harvard'
})

function passage(documentId: string, title: string, page: number, snippet: string): RankedPassage {
  return {
    id: `${documentId}:${page}:0`,
    documentId,
    documentTitle: title,
    pageNumber: page,
    snippet,
    score: 0.9,
    citations: cites()
  }
}

describe('buildMockSynthesis', () => {
  it('groups passages by document into sub-claims with evidence', () => {
    const passages = [
      passage('d1', 'Paper A', 1, 'Warming accelerates.'),
      passage('d1', 'Paper A', 2, 'Ice melts faster.'),
      passage('d2', 'Paper B', 5, 'Seas rise globally.')
    ]
    const r = buildMockSynthesis('Climate is warming', passages)
    expect(r.subClaims).toHaveLength(2)
    expect(r.subClaims[0].evidence.length).toBeGreaterThan(0)
    expect(r.consideredPassageCount).toBe(3)
    // 2+ documents -> a tension is surfaced.
    expect(r.tensions.length).toBeGreaterThan(0)
    expect(r.summary).toContain('Climate is warming')
  })

  it('handles the empty case gracefully', () => {
    const r = buildMockSynthesis('Nothing here', [])
    expect(r.subClaims).toHaveLength(0)
    expect(r.tensions).toHaveLength(0)
    expect(r.consideredPassageCount).toBe(0)
    expect(r.summary.toLowerCase()).toContain('no supporting')
  })

  it('evidence carries the real citations from the passage', () => {
    const r = buildMockSynthesis('x', [passage('d1', 'A', 1, 'quote')])
    expect(r.subClaims[0].evidence[0].citations.mla).toBe('MLA')
  })
})
