// Main-process PDF text extraction. Runs once at import time so a document
// becomes fully indexed without the user needing to page through it.
//
// Why dynamic import: pdfjs-dist is ESM-only. electron-vite bundles the main
// process as CJS, so a top-level `import` would force everything in this file
// into ESM mode. A dynamic `import()` lets us load the legacy worker-less
// build on demand and keep the rest of main as CJS.

import { readFile } from 'fs/promises'
import type { ExtractedPagePayload } from '@shared/types/database'

const MAX_PAGE_TEXT_CHARS = 200_000

type PdfjsModule = typeof import('pdfjs-dist')
let cached: PdfjsModule | null = null

async function loadPdfjs(): Promise<PdfjsModule> {
  if (cached) return cached
  // The legacy build is shipped as pure ESM JS without a Web Worker
  // dependency — runs fine inside the Node side of Electron's main process.
  const mod = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfjsModule
  cached = mod
  return mod
}

function flattenTextContent(items: ReadonlyArray<unknown>): string {
  return (
    items
      .map((raw) => {
        if (!raw || typeof raw !== 'object') return ''
        const item = raw as { str?: unknown; hasEOL?: unknown }
        if (typeof item.str !== 'string') return ''
        return item.hasEOL ? `${item.str}\n` : item.str
      })
      .join(' ')
      // Strip whitespace right before a newline (join may have left some) and
      // right after a newline (so a "first line\n second" never produces a
      // visual leading space on the next line).
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim()
  )
}

export interface ExtractedDocument {
  pageCount: number
  pages: ExtractedPagePayload[]
}

// Reads the PDF at `filePath`, extracts text for every page, and returns one
// payload entry per page. Caller is responsible for persistence.
//
// Errors (encrypted PDF, corrupt PDF, image-only PDF) bubble up so the
// importer can decide what to do — we don't want to silently swallow them
// and produce a partially indexed document.
export async function extractAllPages(filePath: string): Promise<ExtractedDocument> {
  const pdfjs = await loadPdfjs()
  const buf = await readFile(filePath)
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)

  const task = pdfjs.getDocument({
    data,
    // Save a chunk of memory for big PDFs by skipping the eager fetch of all
    // pages — we walk page-by-page below anyway.
    disableAutoFetch: true,
    disableStream: true,
    // Don't try to fetch system fonts; we only need glyph metadata + text.
    useSystemFonts: false
  })
  const doc = await task.promise
  try {
    const pages: ExtractedPagePayload[] = []
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber)
      try {
        const content = await page.getTextContent()
        const flat = flattenTextContent(content.items)
        const safe = flat.length > MAX_PAGE_TEXT_CHARS ? flat.slice(0, MAX_PAGE_TEXT_CHARS) : flat
        const wordCount = safe.trim() === '' ? 0 : safe.split(/\s+/).filter(Boolean).length
        pages.push({ pageNumber, textContent: safe, estimatedWordCount: wordCount })
      } finally {
        page.cleanup()
      }
    }
    return { pageCount: doc.numPages, pages }
  } finally {
    await doc.cleanup().catch(() => undefined)
    await doc.destroy().catch(() => undefined)
  }
}

// Test helper: pure text-flattening, no I/O. Exported so unit tests can
// pin the heuristics without standing up pdf.js.
export const __test = { flattenTextContent }
