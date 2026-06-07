// Best-effort citation-metadata extraction at import time. This is a BONUS —
// PDFs rarely carry a usable author and never a publisher; EPUB is hit or miss.
// The manual citation-details editor is the primary path, so every branch here
// fails soft (returns {} / leaves fields null) and never blocks import.

import { readFile } from 'fs/promises'
import type { DocMetadata } from '@shared/types/database'
import type { FileType } from '@shared/formats'
import { updateDocumentMetadata } from '../../db/repositories/documentRepository'
import { readEpubMetadata } from '../extractors/epubExtractor'

type PdfjsModule = typeof import('pdfjs-dist')
let cachedPdfjs: PdfjsModule | null = null

async function loadPdfjs(): Promise<PdfjsModule> {
  if (cachedPdfjs) return cachedPdfjs
  cachedPdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfjsModule
  return cachedPdfjs
}

// pdf.js dates look like "D:20200131120000Z". Pull the leading 4-digit year.
function parsePdfYear(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const m = value.match(/(\d{4})/)
  return m ? Number.parseInt(m[1], 10) : null
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length > 0 && t.length < 300 ? t : null
}

async function extractPdfMetadata(filePath: string): Promise<Partial<DocMetadata>> {
  try {
    const pdfjs = await loadPdfjs()
    const buf = await readFile(filePath)
    const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    const doc = await pdfjs.getDocument({ data, useSystemFonts: false }).promise
    try {
      const meta = await doc.getMetadata()
      const info = (meta.info ?? {}) as Record<string, unknown>
      return {
        author: cleanString(info.Author),
        year: parsePdfYear(info.CreationDate) ?? parsePdfYear(info.ModDate),
        publisher: null
      }
    } finally {
      await doc.cleanup().catch(() => undefined)
      await doc.destroy().catch(() => undefined)
    }
  } catch {
    return {}
  }
}

export async function extractDocMetadata(
  filePath: string,
  fileType: FileType
): Promise<Partial<DocMetadata>> {
  if (fileType === 'pdf') return extractPdfMetadata(filePath)
  if (fileType === 'epub') return readEpubMetadata(filePath)
  return {}
}

// Extract and persist whatever we can. Only writes fields we actually found, so
// it never clobbers user edits with nulls. Swallows all errors.
export async function applyExtractedMetadata(
  documentId: string,
  filePath: string,
  fileType: FileType
): Promise<void> {
  try {
    const meta = await extractDocMetadata(filePath, fileType)
    const patch: Partial<DocMetadata> = {}
    if (meta.author) patch.author = meta.author
    if (meta.year) patch.year = meta.year
    if (meta.publisher) patch.publisher = meta.publisher
    if (Object.keys(patch).length > 0) updateDocumentMetadata(documentId, patch)
  } catch (err) {
    console.warn('[fuzzy] metadata extraction failed', err)
  }
}
