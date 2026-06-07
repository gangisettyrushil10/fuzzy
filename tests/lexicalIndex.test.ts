import { describe, it, expect } from 'vitest'
import { LexicalIndex, type IndexedChunk } from '../src/main/services/thesis/lexicalIndex'
import { tokenizeForSearch, segmentIntoChunks } from '../src/main/services/thesis/textSegmentation'

function chunk(id: string, documentId: string, text: string): IndexedChunk {
  return {
    id,
    documentId,
    pageNumber: 1,
    chunkIndex: Number(id.split(':').pop()),
    text,
    tokens: tokenizeForSearch(text)
  }
}

describe('tokenizeForSearch', () => {
  it('lowercases, splits, and drops stopwords + 1-char tokens', () => {
    expect(tokenizeForSearch('The Rapid melting of Arctic ice')).toEqual([
      'rapid',
      'melting',
      'arctic',
      'ice'
    ])
  })
})

describe('segmentIntoChunks', () => {
  it('splits into sentence-ish chunks and merges short fragments', () => {
    const chunks = segmentIntoChunks(
      'Climate change accelerates. Sea levels rise across the globe steadily over the decades.'
    )
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks.every((c) => c.text.length > 0)).toBe(true)
  })
})

describe('LexicalIndex (BM25-lite)', () => {
  it('ranks the most relevant chunk first', () => {
    const idx = new LexicalIndex()
    idx.addDocument('d1', [
      chunk('d1:1:0', 'd1', 'Arctic sea ice is melting rapidly due to warming oceans.'),
      chunk('d1:1:1', 'd1', 'The recipe calls for two cups of flour and a pinch of salt.')
    ])
    const results = idx.search(tokenizeForSearch('melting arctic sea ice'), 5)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].chunk.id).toBe('d1:1:0')
  })

  it('reflects added and removed documents', () => {
    const idx = new LexicalIndex()
    idx.addDocument('d1', [chunk('d1:1:0', 'd1', 'photosynthesis converts sunlight into energy')])
    idx.addDocument('d2', [chunk('d2:1:0', 'd2', 'mitochondria are the powerhouse of the cell')])
    expect(idx.documentCount).toBe(2)

    let r = idx.search(tokenizeForSearch('photosynthesis sunlight'), 5)
    expect(r[0].chunk.documentId).toBe('d1')

    idx.removeDocument('d1')
    expect(idx.hasDocument('d1')).toBe(false)
    r = idx.search(tokenizeForSearch('photosynthesis sunlight'), 5)
    expect(r.every((s) => s.chunk.documentId !== 'd1')).toBe(true)
  })

  it('returns nothing for an empty query or empty index', () => {
    const idx = new LexicalIndex()
    expect(idx.search([], 5)).toEqual([])
    idx.addDocument('d1', [chunk('d1:1:0', 'd1', 'hello world')])
    expect(idx.search(tokenizeForSearch('zzz nonexistent'), 5)).toEqual([])
  })
})
