// EPUB text extractor. Implemented by the EPUB agent.
//
// Contract: given the on-disk path to an .epub, return an ExtractedDocument
// whose `pages` are the book's chapters/sections in spine order. Use the
// helpers in ./sectionUtils (sectionsToDocument) to assemble the result. EPUB
// is a ZIP of XHTML; parse with `jszip` (already installed) and strip tags to
// text. Do NOT edit shared files — when this works, tell the parent to flip
// `extractorReady` for 'epub' in '@shared/formats'.

import { readFile } from 'fs/promises'
import JSZip from 'jszip'

import type { DocMetadata, ExtractedDocument } from '@shared/types/database'
import { richSectionsToDocument } from './sectionUtils'
import { guessImageMime, toRichSection, type RichSection } from './htmlUtils'

// Skip inlining images larger than this (decoded bytes). Keeps the DB bounded —
// a single full-bleed cover scan can be multiple MB; books rarely need them.
const MAX_INLINE_IMAGE_BYTES = 512 * 1024

export async function extractEpub(filePath: string): Promise<ExtractedDocument> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(await readFile(filePath))
  } catch (err) {
    throw new Error(
      `Failed to open EPUB "${filePath}" (it may be corrupt or DRM-protected): ${errMessage(err)}`
    )
  }

  const containerXml = await readZipText(zip, 'META-INF/container.xml')
  if (containerXml === null) {
    throw new Error(`Invalid EPUB "${filePath}": missing META-INF/container.xml`)
  }

  const opfPath = findOpfPath(containerXml)
  if (!opfPath) {
    throw new Error(`Invalid EPUB "${filePath}": no rootfile (.opf) declared in container.xml`)
  }

  const opfXml = await readZipText(zip, opfPath)
  if (opfXml === null) {
    throw new Error(`Invalid EPUB "${filePath}": OPF package document "${opfPath}" not found`)
  }

  const opfDir = dirname(opfPath)
  const manifest = parseManifest(opfXml)
  const spine = parseSpine(opfXml)

  const sections: RichSection[] = []
  for (const idref of spine) {
    const href = manifest.get(idref)
    if (!href) continue
    const docPath = resolvePath(opfDir, href)
    const xhtml = await readZipText(zip, docPath)
    if (xhtml === null) continue
    // Inline images (resolved against this chapter's folder) as data URIs, then
    // sanitize + project. toRichSection drops empty/structural-only chapters.
    const withImages = await inlineEpubImages(xhtml, zip, dirname(docPath))
    const section = toRichSection(withImages)
    if (section) sections.push(section)
  }

  if (sections.length === 0) {
    throw new Error(`No readable content found in EPUB "${filePath}" (empty or unsupported spine).`)
  }

  return richSectionsToDocument(sections)
}

// Rewrite every <img src> / SVG <image href> that points at a ZIP entry into a
// self-contained data: URI, so the rendered chapter needs no external assets.
// Oversized or unreadable images are dropped (src emptied) rather than inlined.
async function inlineEpubImages(html: string, zip: JSZip, baseDir: string): Promise<string> {
  const refRe = /(<(?:img|image)\b[^>]*?\s(?:src|xlink:href|href)\s*=\s*)(["'])(.*?)\2/gi
  const matches = Array.from(html.matchAll(refRe))
  if (matches.length === 0) return html

  // Resolve each unique ref to a data URI once (chapters reuse images).
  const cache = new Map<string, string | null>()
  for (const m of matches) {
    const rawRef = m[3]
    if (!rawRef || rawRef.startsWith('data:') || /^https?:/i.test(rawRef)) continue
    if (cache.has(rawRef)) continue
    cache.set(rawRef, await readImageAsDataUri(zip, resolvePath(baseDir, rawRef)))
  }

  return html.replace(refRe, (whole, prefix: string, quote: string, ref: string) => {
    if (!ref || ref.startsWith('data:') || /^https?:/i.test(ref)) return whole
    const dataUri = cache.get(ref)
    return dataUri ? `${prefix}${quote}${dataUri}${quote}` : `${prefix}${quote}${quote}`
  })
}

async function readImageAsDataUri(zip: JSZip, path: string): Promise<string | null> {
  const entry = zip.file(path) ?? findEntryCaseInsensitive(zip, path)
  if (!entry) return null
  const mime = guessImageMime(path)
  if (!mime) return null
  try {
    const buf = await entry.async('nodebuffer')
    if (buf.length > MAX_INLINE_IMAGE_BYTES) return null
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// Net-new: extract Dublin Core citation metadata from the OPF <metadata> block.
// Tolerant of EPUB2 (`<dc:creator>`) and unprefixed (`<creator>`) tags, and of
// missing fields (the common case). Returns only what it confidently finds.
export function parseOpfMetadata(opfXml: string): Partial<DocMetadata> {
  const block = opfXml.match(/<metadata\b[^>]*>([\s\S]*?)<\/metadata>/i)?.[1] ?? opfXml
  const pick = (tag: string): string | null => {
    const m =
      block.match(new RegExp(`<dc:${tag}\\b[^>]*>([\\s\\S]*?)</dc:${tag}>`, 'i')) ??
      block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
    if (!m) return null
    const value = decodeEntities(m[1].replace(/<[^>]+>/g, '')).trim()
    return value || null
  }
  const dateStr = pick('date')
  const yearMatch = dateStr?.match(/\b(\d{4})\b/)
  return {
    author: pick('creator'),
    year: yearMatch ? Number.parseInt(yearMatch[1], 10) : null,
    publisher: pick('publisher')
  }
}

// Read and parse OPF metadata straight from an .epub on disk. Best-effort: any
// failure (corrupt zip, no OPF) returns {} rather than throwing.
export async function readEpubMetadata(filePath: string): Promise<Partial<DocMetadata>> {
  try {
    const zip = await JSZip.loadAsync(await readFile(filePath))
    const containerXml = await readZipText(zip, 'META-INF/container.xml')
    if (!containerXml) return {}
    const opfPath = findOpfPath(containerXml)
    if (!opfPath) return {}
    const opfXml = await readZipText(zip, opfPath)
    if (!opfXml) return {}
    return parseOpfMetadata(opfXml)
  } catch {
    return {}
  }
}

async function readZipText(zip: JSZip, path: string): Promise<string | null> {
  // EPUB paths are case-sensitive ZIP entries; try the exact path first, then a
  // case-insensitive fallback for sloppily-authored archives.
  const entry = zip.file(path) ?? findEntryCaseInsensitive(zip, path)
  if (!entry) return null
  return entry.async('string')
}

function findEntryCaseInsensitive(zip: JSZip, path: string): JSZip.JSZipObject | null {
  const lower = path.toLowerCase()
  let match: JSZip.JSZipObject | null = null
  zip.forEach((relativePath, file) => {
    if (!match && relativePath.toLowerCase() === lower) match = file
  })
  return match
}

function findOpfPath(containerXml: string): string | null {
  const match = containerXml.match(/<rootfile\b[^>]*\bfull-path\s*=\s*["']([^"']+)["']/i)
  return match ? normalizeZipPath(match[1]) : null
}

function parseManifest(opfXml: string): Map<string, string> {
  const manifest = new Map<string, string>()
  const manifestBlock = opfXml.match(/<manifest\b[^>]*>([\s\S]*?)<\/manifest>/i)?.[1] ?? opfXml
  const itemRe = /<item\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(manifestBlock)) !== null) {
    const tag = m[0]
    const id = attr(tag, 'id')
    const href = attr(tag, 'href')
    if (id && href) manifest.set(id, decodeEntities(href))
  }
  return manifest
}

function parseSpine(opfXml: string): string[] {
  const spineBlock = opfXml.match(/<spine\b[^>]*>([\s\S]*?)<\/spine>/i)?.[1] ?? ''
  const ids: string[] = []
  const refRe = /<itemref\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = refRe.exec(spineBlock)) !== null) {
    const tag = m[0]
    // Skip items explicitly marked non-linear? Keep them — they're still content.
    const idref = attr(tag, 'idref')
    if (idref) ids.push(idref)
  }
  return ids
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))
  return match ? match[1] : null
}

// Strip XHTML to readable plain text, preserving paragraph breaks.
export function htmlToText(html: string): string {
  let text = html

  // Drop the head and any script/style blocks entirely (with their content).
  text = text.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  // Remove comments.
  text = text.replace(/<!--[\s\S]*?-->/g, '')

  // Convert line breaks and block-level boundaries to newlines.
  text = text.replace(/<br\s*\/?>/gi, '\n')
  const blockTags =
    'address|article|aside|blockquote|div|dl|dd|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tr|ul'
  // Closing block tags -> paragraph break.
  text = text.replace(new RegExp(`</(?:${blockTags})>`, 'gi'), '\n\n')
  // Opening block tags -> newline (covers void/self-closing like <hr/>).
  text = text.replace(new RegExp(`<(?:${blockTags})\\b[^>]*>`, 'gi'), '\n')

  // Strip all remaining tags.
  text = text.replace(/<[^>]+>/g, '')

  // Decode entities after tag removal.
  text = decodeEntities(text)

  // Normalize whitespace while keeping paragraph breaks.
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  // Collapse runs of spaces/tabs.
  text = text.replace(/[ \t\f\v]+/g, ' ')
  // Trim spaces around newlines.
  text = text.replace(/ *\n */g, '\n')
  // Collapse 3+ newlines into a paragraph break.
  text = text.replace(/\n{3,}/g, '\n\n')

  return text.trim()
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'"
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    const lower = body.toLowerCase()
    if (lower[0] === '#') {
      const codePoint =
        lower[1] === 'x' ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10)
      if (Number.isFinite(codePoint) && codePoint > 0) {
        try {
          return String.fromCodePoint(codePoint)
        } catch {
          return whole
        }
      }
      return whole
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, lower)
      ? NAMED_ENTITIES[lower]
      : whole
  })
}

// --- ZIP-internal path helpers (always POSIX '/', no Node `path`). ---

function normalizeZipPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '')
}

function dirname(p: string): string {
  const idx = p.lastIndexOf('/')
  return idx === -1 ? '' : p.slice(0, idx)
}

function resolvePath(base: string, href: string): string {
  const cleanHref = normalizeZipPath(safeDecodeURI(href).split('#')[0])
  if (cleanHref.startsWith('/')) return cleanHref.slice(1)
  const parts = (base ? base.split('/') : []).concat(cleanHref.split('/'))
  const stack: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  return stack.join('/')
}

function safeDecodeURI(href: string): string {
  try {
    return decodeURIComponent(href)
  } catch {
    return href
  }
}
