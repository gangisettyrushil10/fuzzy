// Pure rank-fusion helpers (no electron/openai/db imports — unit-tested).

const RRF_K = 60

// Reciprocal Rank Fusion: given several rankings (each an id list, best-first),
// return a fused score per id. score = Σ 1/(k + rank). Higher = better. Robust
// to differing score scales across rankers (lexical vs cosine).
export function reciprocalRankFusion(rankings: string[][], k: number = RRF_K): Map<string, number> {
  const scores = new Map<string, number>()
  for (const ranking of rankings) {
    for (let rank = 0; rank < ranking.length; rank++) {
      const id = ranking[rank]
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1))
    }
  }
  return scores
}
