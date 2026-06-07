import { describe, it, expect } from 'vitest'
import {
  EMBED_DIM,
  cosineSimilarity,
  fnv1a,
  l2normalize,
  pseudoEmbed
} from '../src/main/services/embeddings/embeddingMock'

describe('fnv1a', () => {
  it('is deterministic and unsigned', () => {
    expect(fnv1a('darcy')).toBe(fnv1a('darcy'))
    expect(fnv1a('darcy')).not.toBe(fnv1a('elizabeth'))
    expect(fnv1a('x')).toBeGreaterThanOrEqual(0)
  })
})

describe('pseudoEmbed', () => {
  it('is deterministic, correctly dimensioned, and unit-normalized', () => {
    const a = pseudoEmbed('the quick brown fox')
    const b = pseudoEmbed('the quick brown fox')
    expect(a.length).toBe(EMBED_DIM)
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 6)
    let norm = 0
    for (const x of a) norm += x * x
    expect(Math.sqrt(norm)).toBeCloseTo(1, 5)
  })

  it('gives shared-word texts higher cosine than disjoint texts', () => {
    const base = pseudoEmbed('elizabeth loved darcy deeply')
    const overlap = pseudoEmbed('elizabeth and darcy')
    const disjoint = pseudoEmbed('quantum thermodynamics lattice')
    expect(cosineSimilarity(base, overlap)).toBeGreaterThan(cosineSimilarity(base, disjoint))
  })
})

describe('cosineSimilarity', () => {
  it('returns 0 for mismatched dimensions and zero vectors', () => {
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([1, 0, 0]))).toBe(0)
    expect(cosineSimilarity(new Float32Array([0, 0]), new Float32Array([0, 0]))).toBe(0)
  })

  it('is 1 for identical normalized vectors', () => {
    const v = l2normalize(new Float32Array([3, 4]))
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 6)
  })
})
