// Worker-thread entry for local embeddings. Runs the onnxruntime/transformers.js
// inference off the main process so embedding a large book never stalls the UI
// or IPC. Spawned (and bundled to out/main/embedWorker.js) by localEmbed.ts.
//
// Protocol — main posts { id, texts }; we reply with either
//   { id, ok: true, data: Float32Array(n*dim), dim, n }  (data.buffer transferred)
// or { id, ok: false } when the model is unavailable / extraction fails.

import { parentPort, workerData } from 'worker_threads'
import { extractFlat, loadExtractor } from './embedCore'

const cacheDir: string = (workerData as { cacheDir?: string } | undefined)?.cacheDir ?? ''

interface Req {
  id: number
  texts: string[]
}

parentPort?.on('message', async (msg: Req) => {
  const fail = (): void => parentPort!.postMessage({ id: msg.id, ok: false })
  const extractor = await loadExtractor(cacheDir)
  if (!extractor) return fail()
  const flat = await extractFlat(extractor, msg.texts)
  if (!flat) return fail()
  parentPort!.postMessage(
    { id: msg.id, ok: true, data: flat.data, dim: flat.dim, n: msg.texts.length },
    [flat.data.buffer as ArrayBuffer]
  )
})
