// DOCX text extractor. Implemented by the DOCX agent.
//
// Contract: given the on-disk path to a .docx, return an ExtractedDocument
// whose `pages` are readable sections. We convert the document to HTML with
// `mammoth` so we can split on heading boundaries (each chapter/heading becomes
// a section); if that yields nothing usable we fall back to raw text chunked by
// size/paragraphs. Assembled via the helpers in ./sectionUtils.

import mammoth from 'mammoth'

import type { ExtractedDocument } from '@shared/types/database'
import { plainTextToDocument, sectionsToDocument } from './sectionUtils'

// Splits mammoth's HTML output into ordered section texts, starting a new
// section at each heading (h1–h6) so chapters/headings read as their own page.
// Returns readable plain text per section with paragraph breaks preserved.
function htmlToSections(html: string): string[] {
  // Break the document into blocks at heading boundaries. Everything up to the
  // first heading stays as a leading block (e.g. title pages / front matter).
  const blocks = html.split(/(?=<h[1-6][\s>])/i)
  const sections: string[] = []
  for (const block of blocks) {
    const text = htmlBlockToText(block)
    if (text) sections.push(text)
  }
  return sections
}

// Converts a chunk of HTML to readable plain text: block-level tags become
// paragraph/line breaks, remaining tags are stripped, entities are decoded.
function htmlBlockToText(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6]|tr|table|blockquote)\s*>/gi, '\n\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
  const stripped = withBreaks.replace(/<[^>]+>/g, '')
  return normalizeText(decodeEntities(stripped))
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
}

// Collapses excess whitespace while keeping paragraph breaks meaningful.
function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function extractDocx(filePath: string): Promise<ExtractedDocument> {
  let html: string
  try {
    const result = await mammoth.convertToHtml({ path: filePath })
    html = result.value
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to extract DOCX "${filePath}": ${reason}`)
  }

  const sections = htmlToSections(html)
  if (sections.length > 0) {
    return sectionsToDocument(sections)
  }

  // Fallback: no heading structure (or HTML produced no text) — use raw text
  // chunked by size/paragraphs so we still return readable content.
  try {
    const raw = await mammoth.extractRawText({ path: filePath })
    return plainTextToDocument(raw.value)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to extract DOCX "${filePath}": ${reason}`)
  }
}
