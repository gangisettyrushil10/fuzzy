// Shared helpers for turning extracted text into ordered "sections" that fit
// the ExtractedDocument contract. Reflowable formats (epub/txt/md/docx/mobi)
// don't have real pages, so we model each chapter/block/chunk as a 1-based
// "page". Keep these helpers pure so per-format extractors stay tiny.

import type { ExtractedDocument, ExtractedPagePayload } from '@shared/types/database'
import type { RichSection } from './htmlUtils'

const MAX_SECTION_CHARS = 12_000

export function wordCount(text: string): number {
  const t = text.trim()
  return t === '' ? 0 : t.split(/\s+/).filter(Boolean).length
}

// Splits one large text blob into readable sections, preferring paragraph
// boundaries and never exceeding MAX_SECTION_CHARS per section.
export function chunkPlainText(text: string, maxChars = MAX_SECTION_CHARS): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (normalized === '') return []
  if (normalized.length <= maxChars) return [normalized]

  const paragraphs = normalized.split(/\n{2,}/)
  const sections: string[] = []
  let buf = ''
  for (const para of paragraphs) {
    if (para.length > maxChars) {
      if (buf) {
        sections.push(buf.trim())
        buf = ''
      }
      for (let i = 0; i < para.length; i += maxChars) {
        sections.push(para.slice(i, i + maxChars).trim())
      }
      continue
    }
    if ((buf + '\n\n' + para).length > maxChars) {
      sections.push(buf.trim())
      buf = para
    } else {
      buf = buf ? `${buf}\n\n${para}` : para
    }
  }
  if (buf.trim()) sections.push(buf.trim())
  return sections.filter(Boolean)
}

// Builds an ExtractedDocument from an ordered list of section texts (e.g. EPUB
// chapters or DOCX paragraphs). Empty sections are dropped; page numbers are
// assigned 1..N in order.
export function sectionsToDocument(rawSections: string[]): ExtractedDocument {
  const pages: ExtractedPagePayload[] = []
  let pageNumber = 1
  for (const raw of rawSections) {
    const textContent = raw.trim()
    if (!textContent) continue
    pages.push({ pageNumber, textContent, estimatedWordCount: wordCount(textContent) })
    pageNumber++
  }
  return { pageCount: pages.length, pages }
}

// Convenience for single-blob formats (txt): chunk then assemble.
export function plainTextToDocument(text: string): ExtractedDocument {
  return sectionsToDocument(chunkPlainText(text))
}

// Builds an ExtractedDocument from ordered rich sections (sanitized HTML + its
// plain-text projection). text_content stays canonical for search/word-order;
// html_content carries the formatting. Empty sections (no readable text) are
// dropped. Used by the epub/docx/md/mobi rich extractors.
export function richSectionsToDocument(sections: RichSection[]): ExtractedDocument {
  const pages: ExtractedPagePayload[] = []
  let pageNumber = 1
  for (const section of sections) {
    const textContent = section.text.trim()
    if (!textContent) continue
    pages.push({
      pageNumber,
      textContent,
      htmlContent: section.html,
      estimatedWordCount: wordCount(textContent)
    })
    pageNumber++
  }
  return { pageCount: pages.length, pages }
}
