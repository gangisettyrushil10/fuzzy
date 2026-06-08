// Thread-agnostic feature-extraction core, shared by the embed worker thread
// and the in-process fallback in localEmbed.ts. Deliberately has NO electron
// imports so it can run inside a worker_thread (where the electron `app` API is
// unavailable — the model cache dir is passed in instead).

export const LOCAL_EMBED_MODEL = 'local-minilm-l6-v2'
export const LOCAL_EMBED_DIM = 384

const HF_MODEL_ID = 'Xenova/all-MiniLM-L6-v2'
const SUB_BATCH = 32

interface EmbedTensor {
  data: Float32Array
  dims: number[]
}
type FeatureExtractor = (
  texts: string | string[],
  opts: { pooling: 'mean'; normalize: boolean }
) => Promise<EmbedTensor>

// transformers.js is ESM-only; load it lazily via dynamic import from this CJS
// bundle. Cached so the model is loaded once per thread.
let pipePromise: Promise<FeatureExtractor | null> | null = null

export function loadExtractor(cacheDir: string): Promise<FeatureExtractor | null> {
  if (!pipePromise) {
    pipePromise = (async () => {
      try {
        const tf = await import('@huggingface/transformers')
        tf.env.cacheDir = cacheDir
        tf.env.allowLocalModels = false
        const extractor = await tf.pipeline('feature-extraction', HF_MODEL_ID)
        return extractor as unknown as FeatureExtractor
      } catch (err) {
        console.warn('[fuzzy embed] model load failed', err)
        return null
      }
    })()
  }
  return pipePromise
}

// Embed `texts` into one flat Float32Array (length n*dim) so the result is a
// single transferable buffer across the worker boundary. Returns null on
// failure. Sub-batched, with awaits between batches so neither thread's event
// loop is monopolised.
export async function extractFlat(
  extractor: FeatureExtractor,
  texts: string[]
): Promise<{ data: Float32Array; dim: number } | null> {
  try {
    const out = new Float32Array(texts.length * LOCAL_EMBED_DIM)
    let written = 0
    let dim = LOCAL_EMBED_DIM
    for (let i = 0; i < texts.length; i += SUB_BATCH) {
      const slice = texts.slice(i, i + SUB_BATCH)
      const tensor = await extractor(slice, { pooling: 'mean', normalize: true })
      dim = tensor.dims[tensor.dims.length - 1]
      out.set(tensor.data.subarray(0, slice.length * dim), written)
      written += slice.length * dim
    }
    return { data: out, dim }
  } catch (err) {
    console.warn('[fuzzy embed] feature extraction failed', err)
    return null
  }
}
