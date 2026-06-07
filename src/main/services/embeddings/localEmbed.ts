// Local, free, offline semantic embeddings via @huggingface/transformers
// (all-MiniLM-L6-v2, 384-dim) running in-process on onnxruntime. No API key and
// no network after the one-time model download (cached under userData/models).
// This is what gives evidence/thesis retrieval real semantic recall regardless
// of which CHAT provider (Groq / OpenAI / mock) is configured — Groq in
// particular has no embeddings endpoint, so local is the default embedder.

import { app } from 'electron'
import { join } from 'path'

export const LOCAL_EMBED_MODEL = 'local-minilm-l6-v2'
export const LOCAL_EMBED_DIM = 384

const HF_MODEL_ID = 'Xenova/all-MiniLM-L6-v2'
const SUB_BATCH = 32

// Minimal shape of the transformers.js feature-extraction pipeline output we use.
interface EmbedTensor {
  data: Float32Array
  dims: number[]
}
type FeatureExtractor = (
  texts: string | string[],
  opts: { pooling: 'mean'; normalize: boolean }
) => Promise<EmbedTensor>

// transformers.js is ESM-only; load it lazily via dynamic import from this CJS
// main bundle so startup isn't blocked and a load failure degrades gracefully
// (callers fall back to the deterministic mock / lexical retrieval).
let pipePromise: Promise<FeatureExtractor | null> | null = null

async function loadPipeline(): Promise<FeatureExtractor | null> {
  try {
    const tf = await import('@huggingface/transformers')
    // Persist the downloaded model under app data (writable in packaged apps).
    tf.env.cacheDir = join(app.getPath('userData'), 'models')
    tf.env.allowLocalModels = false
    const extractor = await tf.pipeline('feature-extraction', HF_MODEL_ID)
    console.log('[fuzzy embed] local embedding model ready')
    return extractor as unknown as FeatureExtractor
  } catch (err) {
    console.warn('[fuzzy embed] local embedding model unavailable; falling back', err)
    return null
  }
}

function getPipeline(): Promise<FeatureExtractor | null> {
  if (!pipePromise) pipePromise = loadPipeline()
  return pipePromise
}

// Embed a batch. Returns null if the model can't load (offline first run, etc.)
// so callers can fall back. Sub-batched to cap peak memory on large documents,
// and the awaits between batches let the main event loop service IPC.
export async function embedLocalBatch(texts: string[]): Promise<Float32Array[] | null> {
  if (texts.length === 0) return []
  const pipe = await getPipeline()
  if (!pipe) return null
  try {
    const out: Float32Array[] = []
    for (let i = 0; i < texts.length; i += SUB_BATCH) {
      const slice = texts.slice(i, i + SUB_BATCH)
      const tensor = await pipe(slice, { pooling: 'mean', normalize: true })
      const dim = tensor.dims[tensor.dims.length - 1]
      for (let r = 0; r < slice.length; r++) {
        out.push(Float32Array.from(tensor.data.subarray(r * dim, (r + 1) * dim)))
      }
    }
    return out
  } catch (err) {
    console.warn('[fuzzy embed] local embedding failed', err)
    return null
  }
}

export async function embedLocalOne(text: string): Promise<Float32Array | null> {
  const res = await embedLocalBatch([text])
  return res && res[0] ? res[0] : null
}
