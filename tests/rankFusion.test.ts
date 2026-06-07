import { describe, it, expect } from 'vitest'
import { reciprocalRankFusion } from '../src/main/services/retrieval/rankFusion'

describe('reciprocalRankFusion', () => {
  it('rewards ids ranked highly across multiple rankers', () => {
    const lexical = ['a', 'b', 'c']
    const vector = ['b', 'a', 'd']
    const fused = reciprocalRankFusion([lexical, vector])
    // 'b' is #2 and #1; 'a' is #1 and #2 — both beat 'c' (only one list) and 'd'.
    const ranked = [...fused.entries()].sort((x, y) => y[1] - x[1]).map(([id]) => id)
    expect(ranked.slice(0, 2).sort()).toEqual(['a', 'b'])
    expect(fused.get('a')).toBeGreaterThan(fused.get('c')!)
  })

  it('returns an empty map for empty rankings', () => {
    expect(reciprocalRankFusion([[], []]).size).toBe(0)
  })

  it('a higher rank contributes a larger score than a lower rank', () => {
    const fused = reciprocalRankFusion([['first', 'second']])
    expect(fused.get('first')!).toBeGreaterThan(fused.get('second')!)
  })
})
