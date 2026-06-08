// DOCX text extractor. Implemented by the DOCX agent.
//
// Contract: given the on-disk path to a .docx, return an ExtractedDocument
// whose `pages` are readable sections. We convert the document to HTML with
// `mammoth` so we can split on heading boundaries (each chapter/heading becomes
// a section); if that yields nothing usable we fall back to raw text chunked by
// size/paragraphs. Assembled via the helpers in ./sectionUtils.

import mammoth from 'mammoth'

import type { ExtractedDocument } from '@shared/types/database'
import { plainTextToDocument, richSectionsToDocument } from './sectionUtils'
import { toRichSection, type RichSection } from './htmlUtils'

// Drop images larger than this when inlining as data URIs (keeps the DB bounded).
const MAX_INLINE_IMAGE_BYTES = 512 * 1024

// mammoth image handler: inline as a base64 data URI, but skip anything large.
const cappedImage = mammoth.images.imgElement((image) =>
  image.read('base64').then((data: string) => {
    // Oversized: emit an empty src so the sanitizer drops it (no broken inline).
    if (data.length > Math.ceil((MAX_INLINE_IMAGE_BYTES * 4) / 3)) return { src: '' }
    return { src: `data:${image.contentType};base64,${data}` }
  })
)

export async function extractDocx(filePath: string): Promise<ExtractedDocument> {
  let html: string
  try {
    const result = await mammoth.convertToHtml({ path: filePath }, { convertImage: cappedImage })
    html = result.value
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to extract DOCX "${filePath}": ${reason}`)
  }

  // Split mammoth's HTML at heading boundaries so each chapter/heading reads as
  // its own section, then sanitize + project each block into a rich section.
  const blocks = html.split(/(?=<h[1-6][\s>])/i)
  const sections: RichSection[] = []
  for (const block of blocks) {
    const section = toRichSection(block)
    if (section) sections.push(section)
  }
  if (sections.length > 0) {
    return richSectionsToDocument(sections)
  }

  // Fallback: HTML produced no readable text — use raw text chunked by
  // size/paragraphs so we still return something (no rich HTML in this path).
  try {
    const raw = await mammoth.extractRawText({ path: filePath })
    return plainTextToDocument(raw.value)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to extract DOCX "${filePath}": ${reason}`)
  }
}
