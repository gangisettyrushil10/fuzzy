import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getVectors: vi.fn(),
  embedQuery: vi.fn()
}))

vi.mock('../src/main/db/repositories/embeddingRepository', () => ({
  getVectors: mocks.getVectors
}))
vi.mock('../src/main/services/embeddings/embeddingService', () => ({
  embedQuery: mocks.embedQuery
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
        vector: new Float32Array([0, 1, 0])
      }
    ])
    mocks.embedQuery.mockImplementation(async (text: string) => {
      if (text.includes('A character feels trapped by money')) return new Float32Array([1, 0, 0])
      if (text.includes('A contemporary or futuristic story world of gaming')) {
        return new Float32Array([0, 1, 0])
      }
      if (text.includes('A magical or mythic story world')) return new Float32Array([0, 0, 1])
      if (text.includes('cannot pay rent')) return new Float32Array([1, 0, 0])
      return new Float32Array([0, 0, 0])
    })
  })

  it('uses book-world vectors to steer a tense scene toward a tech/lofi palette', async () => {
    const plan = await planEmbeddingSoundtrackQuery({
      classification,
      documentId: 'doc-1',
      pageNumber: 9,
      passageExcerpt: 'I cannot pay rent, and panic keeps closing every possible door.',
      taste: []
    })

    expect(plan).toEqual(
      expect.objectContaining({
        lane: 'Cyber lofi · Trapped desperation',
        source: 'embedding'
      })
    )
    expect(plan?.query).toContain('downtempo electronic lofi beats')
    expect(plan?.queries?.length).toBeGreaterThan(1)
    expect(mocks.getVectors).toHaveBeenCalledWith('doc-1')
    expect(mocks.embedQuery).toHaveBeenCalledWith(expect.any(String), 'test-embedding-model')
  })

  it('keeps the same tense scene orchestral when the book-world vector is fantasy', async () => {
    mocks.getVectors.mockReturnValue([
      {
        id: 'doc-2:9:0',
        documentId: 'doc-2',
        pageNumber: 9,
        chunkIndex: 0,
        textHash: 'hash',
        model: 'test-embedding-model',
        vector: new Float32Array([0, 0, 1])
      }
    ])

    const plan = await planEmbeddingSoundtrackQuery({
      classification,
      documentId: 'doc-2',
      pageNumber: 9,
      passageExcerpt: 'I cannot pay rent, and panic keeps closing every possible door.',
      taste: []
    })

    expect(plan?.lane).toBe('Orchestral fantasy · Trapped desperation')
    expect(plan?.query).toContain('orchestral fantasy strings')
    expect(plan?.query).not.toContain('cyber')
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
