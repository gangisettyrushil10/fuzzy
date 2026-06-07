import { describe, it, expect } from 'vitest'
import { buildExtractiveAnswer, buildPassageBlock } from '../src/main/services/ask/askMock'
import type { CitationFormat, RankedPassage } from '../src/shared/types/database'

const cites = (): Record<CitationFormat, string> => ({ mla: 'M', apa: 'A', chicago: 'C', harvard: 'H' })

function passage(page: number, snippet: string): RankedPassage {
  return {
    id: `d:${page}:0`,
    documentId: 'd',
    documentTitle: 'Doc',
    pageNumber: page,
    snippet,
    score: 0.8,
    citations: cites()
  }
}

describe('buildExtractiveAnswer', () => {
  it('stitches top snippets with page numbers', () => {
    const ans = buildExtractiveAnswer('what happened?', [passage(3, 'A great storm came'), passage(7, 'The ship sank')])
    expect(ans).toContain('A great storm came')
    expect(ans).toContain('p. 3')
  })

  it('admits when nothing is found', () => {
    expect(buildExtractiveAnswer('huh?', []).toLowerCase()).toContain("couldn't find")
  })
})

describe('buildPassageBlock', () => {
  it('numbers passages with their page', () => {
    const block = buildPassageBlock([passage(5, 'alpha'), passage(9, 'beta')])
    expect(block).toContain('P1 (p. 5): alpha')
    expect(block).toContain('P2 (p. 9): beta')
  })
})
