import { describe, it, expect } from 'vitest'
import {
  deriveSearchModel,
  webSearchModels,
  extractWebSources,
  compactPassageBlock
} from '../src/main/services/ask/askWeb'
import type { RankedPassage } from '../src/shared/types/database'

function passage(pageNumber: number, snippet: string): RankedPassage {
  return {
    id: `d:${pageNumber}:0`,
    documentId: 'd',
    documentTitle: 'T',
    pageNumber,
    snippet,
    score: 1,
    citations: { mla: '', apa: '', chicago: '', harvard: '' }
  }
}

describe('compactPassageBlock', () => {
  it('keeps only the top N passages and truncates long snippets', () => {
    const long = 'x'.repeat(1000)
    const block = compactPassageBlock(
      [passage(1, long), passage(2, 'short'), passage(3, 'also short'), passage(4, 'dropped')],
      3,
      400
    )
    expect(block).not.toContain('P4')
    expect(block).toContain('P3')
    expect(block).toContain('…')
    // First passage snippet truncated to 400 chars + ellipsis.
    expect(block.length).toBeLessThan(700)
  })
})

describe('webSearchModels', () => {
  it('offers both Groq compound naming eras for a groq base URL', () => {
    expect(webSearchModels('https://api.groq.com/openai/v1', 'llama-3.3-70b')).toEqual([
      'groq/compound',
      'compound-beta'
    ])
  })

  it('appends :online for OpenRouter and is idempotent', () => {
    expect(webSearchModels('https://openrouter.ai/api/v1', 'openai/gpt-4o-mini')).toEqual([
      'openai/gpt-4o-mini:online'
    ])
    expect(webSearchModels('https://openrouter.ai/api/v1', 'openai/gpt-4o-mini:online')).toEqual([
      'openai/gpt-4o-mini:online'
    ])
  })

  it('passes the model through unchanged for OpenAI / unknown / null', () => {
    expect(webSearchModels('https://api.openai.com/v1', 'gpt-4o')).toEqual(['gpt-4o'])
    expect(webSearchModels(null, 'gpt-4o')).toEqual(['gpt-4o'])
  })

  it('deriveSearchModel returns the first candidate', () => {
    expect(deriveSearchModel('https://api.groq.com/openai/v1', 'x')).toBe('groq/compound')
  })
})

describe('extractWebSources', () => {
  it('returns [] when there are no annotations', () => {
    expect(extractWebSources({})).toEqual([])
    expect(extractWebSources({ annotations: 'nope' })).toEqual([])
    expect(extractWebSources(null)).toEqual([])
  })

  it('extracts url citations, dedupes by URL, and falls back to URL as title', () => {
    const msg = {
      annotations: [
        { url_citation: { url: 'https://a.com', title: 'A' } },
        { url_citation: { url: 'https://a.com', title: 'A dup' } },
        { url_citation: { url: 'https://b.com' } }
      ]
    }
    expect(extractWebSources(msg)).toEqual([
      { url: 'https://a.com', title: 'A' },
      { url: 'https://b.com', title: 'https://b.com' }
    ])
  })

  it('caps at 8 sources', () => {
    const annotations = Array.from({ length: 12 }, (_, i) => ({
      url_citation: { url: `https://x.com/${i}`, title: `t${i}` }
    }))
    expect(extractWebSources({ annotations })).toHaveLength(8)
  })
})
