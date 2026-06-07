// Pure embedding helpers (no electron/openai/db imports — unit-tested in node).
// The deterministic pseudo-embedding keeps the retrieval pipeline + tests
// functional with no API key. It is feature-hashed bag-of-words: same text →
// same vector, and texts that share words get positive cosine. It is NOT a real
// semantic embedding (no synonym recall) — that's the OpenAI path's job.

export const EMBED_DIM = 512
export const MOCK_EMBED_MODEL = `mock-hash-${EMBED_DIM}`

// FNV-1a 32-bit string hash. Deterministic, no deps.
export function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function l2normalize(vec: Float32Array): Float32Array {
  let sum = 0
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i]
  const norm = Math.sqrt(sum)
  if (norm === 0) return vec
  for (let i = 0; i < vec.length; i++) vec[i] /= norm
  return vec
}

// Deterministic feature-hashed embedding of `text` into `dim` dims.
export function pseudoEmbed(text: string, dim: number = EMBED_DIM): Float32Array {
  const vec = new Float32Array(dim)
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1)
  for (const tok of tokens) {
    const h = fnv1a(tok)
    const idx = h % dim
    const sign = (h & 0x80000000) !== 0 ? -1 : 1
    vec[idx] += sign
  }
  return l2normalize(vec)
}

// Cosine similarity. Returns 0 for mismatched dims (defensive) or zero vectors.
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}
