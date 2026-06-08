// Plain-text and Markdown extractors.
//
// .txt stays plain (chunked into sections; no rich HTML). .md is rendered to
// HTML via `marked`, then sanitized + projected into rich sections so it reads
// like a formatted document (headings, lists, emphasis, code blocks). Assembled
// via ./sectionUtils.

import { readFile } from 'fs/promises'
import type { ExtractedDocument } from '@shared/types/database'
import { plainTextToDocument, richSectionsToDocument } from './sectionUtils'
import { toRichSection, type RichSection } from './htmlUtils'

export async function extractTxt(filePath: string): Promise<ExtractedDocument> {
  const text = await readTextFile(filePath)
  return plainTextToDocument(text)
}

export async function extractMarkdown(filePath: string): Promise<ExtractedDocument> {
  const md = await readTextFile(filePath)
  const { marked } = await import('marked')
  const html = await marked.parse(md, { async: true })

  // Split at heading boundaries so long docs chapter naturally; sanitize +
  // project each block. (Markdown image refs that aren't data: URIs are dropped
  // by the sanitizer — we don't read arbitrary filesystem paths here.)
  const blocks = html.split(/(?=<h[1-6][\s>])/i)
  const sections: RichSection[] = []
  for (const block of blocks) {
    const section = toRichSection(block)
    if (section) sections.push(section)
  }
  if (sections.length > 0) return richSectionsToDocument(sections)

  // No usable HTML (e.g. empty file) — fall back to the raw text.
  return plainTextToDocument(md)
}

async function readTextFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf-8')
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to read text file "${filePath}": ${reason}`)
  }
}
