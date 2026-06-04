// PDF.js setup for the renderer. Configures the worker URL once, lazily.
//
// In Electron + Vite the file:// protocol can't fetch the worker as a normal
// script, so we resolve the bundled worker URL at build time via Vite's
// `?url` import and hand it to GlobalWorkerOptions.
import { GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let configured = false
export function ensurePdfjsWorker(): void {
  if (configured) return
  GlobalWorkerOptions.workerSrc = workerUrl
  configured = true
}
