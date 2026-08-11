import { describe, expect, it } from 'vitest'
import { buildCurrentPagePassages, mergeLocalFirstPassages } from '../src/main/services/ask/askContext'
import type { CitationFormat, RankedPassage } from '../src/shared/types/database'

const cites = (): Record<CitationFormat, string> => ({ mla: 'M', apa: 'A', chicago: 'C', harvard: 'H' })

function passage(id: string, pageNumber: number, snippet: string): RankedPassage {
  return {
    id,
    documentId: 'doc',
    documentTitle: 'Book',
    pageNumber,
    snippet,
    score: 0.8,
    citations: cites()
  }
}

describe('buildCurrentPagePassages', () => {
  it('expands local hits forward so vague research questions include the purpose', () => {
    const text = [
      'Remus asked where they had been.',
      'James said they were doing some research in the library, and it was sort of about Remus.',
      'Sirius said he had wanted to tell him since last term.',
      'James said they wanted to do something to help.',
      'Remus said there was no cure.',
      'James said they knew, but they wanted to make him stop hurting himself.'
    ].join(' ')

    const passages = buildCurrentPagePassages('what is james and sirius researching for?', {
      documentId: 'doc',
      documentTitle: 'Book',
      pageNumber: 49,
      text,
      citations: cites()
    })

    const snippets = passages.map((p) => p.snippet).join(' ')
    expect(snippets).toContain('doing some research')
    expect(snippets).toContain('no cure')
    expect(snippets).toContain('stop hurting himself')
  })
})

describe('mergeLocalFirstPassages', () => {
  it('keeps current-page passages before whole-document retrieval and dedupes exact repeats', () => {
    const local = [passage('local', 49, 'local answer')]
    const retrieved = [passage('dupe', 49, 'local answer'), passage('global', 10, 'global answer')]

    expect(mergeLocalFirstPassages(local, retrieved, 3).map((p) => p.id)).toEqual([
      'local',
      'global'
    ])
  })
})
