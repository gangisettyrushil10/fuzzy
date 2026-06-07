// Pure citation formatter: MLA / APA / Chicago (notes) / Harvard from a
// document's metadata + a page number. Metadata is usually incomplete (PDFs
// rarely carry author/publisher; EPUB is hit or miss), so every field has an
// honest fallback — "n.d." for missing years, the title alone when there's no
// author. The manual citation-details editor is the primary path; this just
// formats whatever we have well.

import type { CitationFormat } from '@shared/types/database'

export interface CitationSource {
  title: string
  author: string | null
  year: number | null
  publisher: string | null
}

interface ParsedName {
  last: string
  first: string // may be empty
}

// "Smith, John" -> {last:'Smith', first:'John'}; "John Smith" -> same.
function parseAuthor(author: string): ParsedName {
  const trimmed = author.trim()
  if (trimmed.includes(',')) {
    const [last, first] = trimmed.split(',', 2)
    return { last: last.trim(), first: (first ?? '').trim() }
  }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { last: parts[0], first: '' }
  return { last: parts[parts.length - 1], first: parts.slice(0, -1).join(' ') }
}

function initials(first: string): string {
  return first
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join(' ')
}

function cleanTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim()
}

// MLA: Author. "Title." Publisher, Year, p. N.
function mla(src: CitationSource, page: number): string {
  const parts: string[] = []
  if (src.author) {
    const n = parseAuthor(src.author)
    parts.push(n.first ? `${n.last}, ${n.first}.` : `${n.last}.`)
  }
  parts.push(`"${cleanTitle(src.title)}."`)
  const tail: string[] = []
  if (src.publisher) tail.push(src.publisher)
  tail.push(src.year ? String(src.year) : 'n.d.')
  tail.push(`p. ${page}`)
  parts.push(`${tail.join(', ')}.`)
  return parts.join(' ')
}

// APA: Author, A. (Year). Title. Publisher. (p. N)
function apa(src: CitationSource, page: number): string {
  const year = src.year ? String(src.year) : 'n.d.'
  let lead: string
  if (src.author) {
    const n = parseAuthor(src.author)
    lead = n.first ? `${n.last}, ${initials(n.first)} (${year}).` : `${n.last} (${year}).`
  } else {
    lead = `${cleanTitle(src.title)} (${year}).`
  }
  const segs: string[] = [lead]
  if (src.author) segs.push(`${cleanTitle(src.title)}.`)
  if (src.publisher) segs.push(`${src.publisher}.`)
  segs.push(`(p. ${page})`)
  return segs.join(' ')
}

// Chicago (notes-bibliography, footnote form):
// First Last, Title (Publisher, Year), N.
function chicago(src: CitationSource, page: number): string {
  const segs: string[] = []
  if (src.author) {
    const n = parseAuthor(src.author)
    segs.push(`${[n.first, n.last].filter(Boolean).join(' ')},`)
  }
  const inParen: string[] = []
  if (src.publisher) inParen.push(src.publisher)
  inParen.push(src.year ? String(src.year) : 'n.d.')
  segs.push(`${cleanTitle(src.title)} (${inParen.join(', ')}), ${page}.`)
  return segs.join(' ')
}

// Harvard: Last, F. Year, Title, Publisher, p. N.
function harvard(src: CitationSource, page: number): string {
  const segs: string[] = []
  const year = src.year ? String(src.year) : 'n.d.'
  if (src.author) {
    const n = parseAuthor(src.author)
    segs.push(n.first ? `${n.last}, ${initials(n.first)} ${year},` : `${n.last} ${year},`)
  } else {
    segs.push(`${cleanTitle(src.title)} ${year},`)
  }
  if (src.author) segs.push(`${cleanTitle(src.title)},`)
  if (src.publisher) segs.push(`${src.publisher},`)
  segs.push(`p. ${page}.`)
  return segs.join(' ')
}

export function formatCitation(
  format: CitationFormat,
  src: CitationSource,
  page: number
): string {
  switch (format) {
    case 'mla':
      return mla(src, page)
    case 'apa':
      return apa(src, page)
    case 'chicago':
      return chicago(src, page)
    case 'harvard':
      return harvard(src, page)
  }
}

export function formatAllCitations(
  src: CitationSource,
  page: number
): Record<CitationFormat, string> {
  return {
    mla: mla(src, page),
    apa: apa(src, page),
    chicago: chicago(src, page),
    harvard: harvard(src, page)
  }
}
