import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getVectors: vi.fn(),
  embedQuery: vi.fn(),
  hybridSearchDoc: vi.fn()
}))

vi.mock('../src/main/db/repositories/embeddingRepository', () => ({
  getVectors: mocks.getVectors
}))
vi.mock('../src/main/services/embeddings/embeddingService', () => ({
  embedQuery: mocks.embedQuery
}))
vi.mock('../src/main/services/retrieval/hybridSearch', () => ({
  hybridSearchDoc: mocks.hybridSearchDoc
}))

import {
  clearEmbeddingSoundtrackCache,
  planEmbeddingSoundtrackQuery
} from '../src/main/services/spotify/embeddingSoundtrackService'
import type { AmbientClassification } from '../src/shared/types/api'

const classification: AmbientClassification = {
  mood: 'tension',
  secondaryMood: 'fear',
  genre: 'literary',
  type: 'fiction',
  intensity: 0.76,
  sceneTags: [],
  paletteHints: [],
  motion: 'pulse'
}

describe('embeddingSoundtrackService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearEmbeddingSoundtrackCache()
    mocks.getVectors.mockReturnValue([
      {
        id: 'doc-1:9:0',
        documentId: 'doc-1',
        pageNumber: 9,
        chunkIndex: 0,
        textHash: 'hash',
        model: 'test-embedding-model',
        vector: new Float32Array([1, 0])
      }
    ])
    mocks.hybridSearchDoc.mockResolvedValue([
      {
        id: 'doc-1:9:0',
        documentId: 'doc-1',
        pageNumber: 9,
        snippet: 'The room feels impossible to escape, and every option is closing.'
      }
    ])
    mocks.embedQuery.mockImplementation(async (text: string) => {
      if (text.includes('A character feels trapped by money')) return new Float32Array([1, 0])
      if (text.includes('Technology, hacking')) return new Float32Array([0.7, 0.3])
      if (text.includes('cannot pay rent')) return new Float32Array([1, 0])
      return new Float32Array([0, 1])
    })
  })

  it('scores the visible passage against generic scene anchors in the document embedding space', async () => {
    const plan = await planEmbeddingSoundtrackQuery({
      classification,
      documentId: 'doc-1',
      pageNumber: 9,
      passageExcerpt: 'I cannot pay rent, and panic keeps closing every possible door.',
      taste: []
    })

    expect(plan).toEqual(
      expect.objectContaining({
        lane: 'Trapped desperation',
        source: 'embedding'
      })
    )
    expect(plan?.query).toContain('instrumental')
    expect(plan?.queries?.length).toBeGreaterThan(1)
    expect(mocks.getVectors).toHaveBeenCalledWith('doc-1')
    expect(mocks.hybridSearchDoc).toHaveBeenCalledWith('doc-1', expect.any(String), {
      limit: 3,
      maxPage: 9
    })
    expect(mocks.embedQuery).toHaveBeenCalledWith(expect.any(String), 'test-embedding-model')
  })

  it('does not plan without cached ingestion vectors', async () => {
    mocks.getVectors.mockReturnValue([])

    const plan = await planEmbeddingSoundtrackQuery({
      classification,
      documentId: 'doc-1',
      pageNumber: 9,
      passageExcerpt: 'A visible passage.',
      taste: []
    })

    expect(plan).toBeNull()
  })
})
