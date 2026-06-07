// Tiny dependency-free fuzzy matcher for the command palette. Subsequence
// match (case-insensitive) with scoring that rewards contiguous runs, matches
// at word boundaries, and earlier positions — so "gtp" ranks "Go to page"
// above an incidental match. Returns null when `query` isn't a subsequence.

export function fuzzyScore(query: string, target: string): number | null {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (q.length === 0) return 0

  let qi = 0
  let score = 0
  let streak = 0
  let prevIdx = -1

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue
    let pts = 10
    if (ti === prevIdx + 1) {
      streak += 1
      pts += streak * 5 // contiguous run bonus
    } else {
      streak = 0
    }
    if (ti === 0 || /[\s\-_/:.]/.test(t[ti - 1])) pts += 15 // word-boundary bonus
    pts -= ti * 0.1 // mild earliness preference
    score += pts
    prevIdx = ti
    qi += 1
  }

  return qi === q.length ? score : null
}

export interface FuzzyRanked<T> {
  item: T
  score: number
}

// Filter + sort items by fuzzy score against `getText`. Empty query keeps the
// original order (score 0).
export function fuzzyFilter<T>(
  query: string,
  items: ReadonlyArray<T>,
  getText: (item: T) => string
): T[] {
  const q = query.trim()
  if (!q) return [...items]
  const ranked: Array<FuzzyRanked<T>> = []
  for (const item of items) {
    const score = fuzzyScore(q, getText(item))
    if (score !== null) ranked.push({ item, score })
  }
  ranked.sort((a, b) => b.score - a.score)
  return ranked.map((r) => r.item)
}
