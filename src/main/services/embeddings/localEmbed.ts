// Local, free, offline semantic embeddings (all-MiniLM-L6-v2, 384-dim) via
// @huggingface/transformers on onnxruntime. No API key and no network after the
// one-time model download (cached under userData/models). This is what gives
// evidence/thesis retrieval real semantic recall regardless of the CHAT provider
// (Groq has no embeddings endpoint, so local is the default embedder).
//
// Inference runs in a WORKER THREAD (embedWorker.ts) so embedding a large book
// never stalls the main process / IPC. If the worker can't be spawned (or dies),
// we transparently fall back to in-process embedding via the shared core.

import { app } from 'electron'
import { join } from 'path'
import { Worker } from 'worker_threads'
import { LOCAL_EMBED_DIM, LOCAL_EMBED_MODEL, extractFlat, loadExtractor } from './embedCore'

export { LOCAL_EMBED_MODEL, LOCAL_EMBED_DIM }

function modelCacheDir(): string {
  return join(app.getPath('userData'), 'models')
}

// ---- Worker management ----------------------------------------------------

interface FlatReply {
  id: number
  ok: boolean
  data?: Float32Array
  dim?: number
  n?: number
}
// A pending request resolves to the flat result, null (model unavailable), or
// the 'dead' sentinel (worker errored/exited mid-flight → caller falls back).
type Pending = (value: FlatReply | null | 'dead') => void

let worker: Worker | null = null
let workerUnavailable = false
let nextReqId = 0
const pending = new Map<number, Pending>()

function getWorker(): Worker | null {
  if (workerUnavailable) return null
  if (worker) return worker
  try {
    worker = new Worker(join(__dirname, 'embedWorker.js'), {
      workerData: { cacheDir: modelCacheDir() }
    })
    worker.on('message', (m: FlatReply) => {
      const resolve = pending.get(m.id)
      if (!resolve) return
      pending.delete(m.id)
      resolve(m.ok ? m : null)
    })
    worker.on('error', (err) => {
      console.warn('[fuzzy embed] worker error; falling back in-process', err)
      killWorker()
    })
    worker.on('exit', (code) => {
      if (code !== 0) killWorker()
    })
    // Don't let the embedding worker keep the app alive at quit.
    worker.unref()
    return worker
  } catch (err) {
    console.warn('[fuzzy embed] worker spawn failed; using in-process', err)
    workerUnavailable = true
    return null
  }
}

function killWorker(): void {
  workerUnavailable = true
  for (const resolve of pending.values()) resolve('dead')
  pending.clear()
  worker?.terminate().catch(() => {})
  worker = null
}

export function terminateEmbedWorker(): void {
  if (worker) {
    worker.terminate().catch(() => {})
    worker = null
  }
}

function requestFromWorker(w: Worker, texts: string[]): Promise<FlatReply | null | 'dead'> {
  const id = ++nextReqId
  return new Promise((resolve) => {
    pending.set(id, resolve)
    w.postMessage({ id, texts })
  })
}

// ---- Public API -----------------------------------------------------------

function splitFlat(data: Float32Array, dim: number, n: number): Float32Array[] {
  const out: Float32Array[] = []
  for (let i = 0; i < n; i++) out.push(data.subarray(i * dim, (i + 1) * dim))
  return out
}

async function embedInProcess(texts: string[]): Promise<Float32Array[] | null> {
  const extractor = await loadExtractor(modelCacheDir())
  if (!extractor) return null
  const flat = await extractFlat(extractor, texts)
  if (!flat) return null
  return splitFlat(flat.data, flat.dim, texts.length)
}

// Embed a batch. Returns null if embeddings are unavailable (offline first run)
// so callers can fall back to mock/lexical retrieval.
export async function embedLocalBatch(texts: string[]): Promise<Float32Array[] | null> {
  if (texts.length === 0) return []
  const w = getWorker()
  if (w) {
    const reply = await requestFromWorker(w, texts)
    if (reply === 'dead') {
      // Worker died mid-request — fall through to in-process below.
    } else if (reply === null) {
      return null // model genuinely unavailable; don't double-load in-process
    } else if (reply.data && reply.dim && reply.n != null) {
      return splitFlat(reply.data, reply.dim, reply.n)
    }
  }
  return embedInProcess(texts)
}

export async function embedLocalOne(text: string): Promise<Float32Array | null> {
  const res = await embedLocalBatch([text])
  return res && res[0] ? res[0] : null
}
