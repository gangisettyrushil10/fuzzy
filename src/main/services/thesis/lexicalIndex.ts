// BM25-lite in-memory inverted index over page chunks. Incremental add (cheap,
// used when a newly-imported document is first searched) and rebuild-on-remove
// (correctness over cleverness — deletions are rare). Lives in main for the
// app session; not persisted (no thesis_index table for v1).

const K1 = 1.5
const B = 0.75

export interface IndexedChunk {
  id: string
  documentId: string
  pageNumber: number
  chunkIndex: number
  text: string
  tokens: string[]
}

export interface ScoredChunk {
  chunk: IndexedChunk
  score: number
}

export class LexicalIndex {
  private chunksById = new Map<string, IndexedChunk>()
  private chunkIdsByDoc = new Map<string, Set<string>>()
  private postings = new Map<string, Map<string, number>>() // term -> (chunkId -> tf)
  private df = new Map<string, number>() // term -> # chunks containing it
  private totalLen = 0

  get chunkCount(): number {
    return this.chunksById.size
  }

  get documentCount(): number {
    return this.chunkIdsByDoc.size
  }

  hasDocument(documentId: string): boolean {
    return this.chunkIdsByDoc.has(documentId)
  }

  indexedDocumentIds(): string[] {
    return [...this.chunkIdsByDoc.keys()]
  }

  addDocument(documentId: string, chunks: IndexedChunk[]): void {
    if (this.chunkIdsByDoc.has(documentId)) return
    const ids = new Set<string>()
    for (const chunk of chunks) {
      this.indexChunk(chunk)
      ids.add(chunk.id)
    }
    this.chunkIdsByDoc.set(documentId, ids)
  }

  removeDocument(documentId: string): void {
    if (!this.chunkIdsByDoc.has(documentId)) return
    this.chunkIdsByDoc.delete(documentId)
    for (const id of [...this.chunksById.keys()]) {
      if (this.chunksById.get(id)?.documentId === documentId) this.chunksById.delete(id)
    }
    this.rebuildPostings()
  }

  private indexChunk(chunk: IndexedChunk): void {
    if (this.chunksById.has(chunk.id)) return
    this.chunksById.set(chunk.id, chunk)
    const termFreq = new Map<string, number>()
    for (const term of chunk.tokens) termFreq.set(term, (termFreq.get(term) ?? 0) + 1)
    for (const [term, tf] of termFreq) {
      let posting = this.postings.get(term)
      if (!posting) {
        posting = new Map()
        this.postings.set(term, posting)
      }
      posting.set(chunk.id, tf)
      this.df.set(term, (this.df.get(term) ?? 0) + 1)
    }
    this.totalLen += chunk.tokens.length
  }

  private rebuildPostings(): void {
    this.postings.clear()
    this.df.clear()
    this.totalLen = 0
    for (const chunk of this.chunksById.values()) {
      // Re-run the per-chunk indexing without the chunksById guard.
      const termFreq = new Map<string, number>()
      for (const term of chunk.tokens) termFreq.set(term, (termFreq.get(term) ?? 0) + 1)
      for (const [term, tf] of termFreq) {
        let posting = this.postings.get(term)
        if (!posting) {
          posting = new Map()
          this.postings.set(term, posting)
        }
        posting.set(chunk.id, tf)
        this.df.set(term, (this.df.get(term) ?? 0) + 1)
      }
      this.totalLen += chunk.tokens.length
    }
  }

  search(queryTokens: string[], limit = 20): ScoredChunk[] {
    const n = this.chunksById.size
    if (n === 0 || queryTokens.length === 0) return []
    const avgdl = this.totalLen / n || 1
    const uniqueTerms = [...new Set(queryTokens)]

    const scores = new Map<string, number>()
    for (const term of uniqueTerms) {
      const posting = this.postings.get(term)
      const df = this.df.get(term)
      if (!posting || !df) continue
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5))
      for (const [chunkId, tf] of posting) {
        const dl = this.chunksById.get(chunkId)?.tokens.length ?? avgdl
        const denom = tf + K1 * (1 - B + (B * dl) / avgdl)
        const contribution = idf * ((tf * (K1 + 1)) / denom)
        scores.set(chunkId, (scores.get(chunkId) ?? 0) + contribution)
      }
    }

    return [...scores.entries()]
      .map(([id, score]) => ({ chunk: this.chunksById.get(id)!, score }))
      .filter((s) => s.chunk)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }
}
