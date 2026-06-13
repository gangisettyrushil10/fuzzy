import { extensionOf } from '@shared/formats'
import type {
  CreateHighlightInput,
  HighlightContentKind,
  HighlightSourceKind
} from '@shared/types/database'

export interface ParsedHighlightImport {
  sourceKind: HighlightSourceKind
  sourceLabel: string
  items: CreateHighlightInput[]
}

type CsvRow = Record<string, string>

const FIELD_ALIASES = {
  title: ['title', 'book title', 'article title', 'document', 'source', 'source title', 'book'],
  author: ['author', 'byline', 'creator'],
  text: ['highlight', 'text', 'selection', 'quote', 'excerpt', 'content', 'passage'],
  note: ['note', 'annotation', 'comment', 'notes'],
  tags: ['tags', 'tag', 'labels'],
  url: ['url', 'source url', 'link', 'href', 'article url'],
  location: ['location', 'page', 'position', 'locator', 'chapter'],
  date: ['date', 'highlighted at', 'created at', 'saved at', 'added on', 'updated at'],
  externalId: ['id', 'highlight id', 'external id', 'uuid'],
  contentKind: ['content kind', 'type', 'item type', 'source type']
} as const

function sourceLabelForKind(kind: HighlightSourceKind): string {
  switch (kind) {
    case 'kindle':
      return 'Kindle'
    case 'instapaper':
      return 'Instapaper'
    case 'apple_books':
      return 'Apple Books'
    case 'generic_csv':
      return 'CSV import'
    case 'generic_json':
      return 'JSON import'
    case 'manual':
      return 'Manual'
  }
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim()
}

function splitTags(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function normalizeDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function normalizeContentKind(raw: string | undefined, fallback: HighlightContentKind): HighlightContentKind {
  const value = raw?.trim().toLowerCase() ?? ''
  if (value.includes('newsletter')) return 'newsletter'
  if (value.includes('rss')) return 'rss'
  if (value.includes('pdf')) return 'pdf'
  if (value.includes('epub')) return 'epub'
  if (value.includes('video') || value.includes('youtube')) return 'video'
  if (value.includes('thread') || value.includes('twitter') || value.includes('x')) return 'thread'
  if (value.includes('web') || value.includes('page')) return 'web'
  if (value.includes('article')) return 'article'
  if (value.includes('book')) return 'book'
  return fallback
}

function cleanTitle(raw: string | undefined): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 240)
}

function pickField(record: Record<string, string>, aliases: readonly string[]): string | undefined {
  for (const alias of aliases) {
    const key = alias.toLowerCase()
    if (record[key]) return record[key]
  }
  return undefined
}

function normalizeRecordKeys(record: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(record)) {
    out[key.trim().toLowerCase()] = String(value ?? '').trim()
  }
  return out
}

function csvRowsFrom(raw: string): CsvRow[] {
  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]
    if (ch === '"') {
      const next = raw[i + 1]
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      row.push(current)
      current = ''
      continue
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && raw[i + 1] === '\n') i += 1
      row.push(current)
      current = ''
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
      continue
    }
    current += ch
  }
  row.push(current)
  if (row.some((cell) => cell.trim() !== '')) rows.push(row)
  if (rows.length === 0) return []
  const headers = rows[0].map((cell) => cell.trim().toLowerCase())
  return rows.slice(1).map((cells) => {
    const out: CsvRow = {}
    headers.forEach((header, index) => {
      out[header] = (cells[index] ?? '').trim()
    })
    return out
  })
}

function detectCsvSourceKind(fileName: string, rows: CsvRow[]): HighlightSourceKind {
  const lowerName = fileName.toLowerCase()
  const headers = Object.keys(rows[0] ?? {})
  if (lowerName.includes('kindle')) return 'kindle'
  if (lowerName.includes('instapaper')) return 'instapaper'
  if (lowerName.includes('apple') || lowerName.includes('ibooks') || lowerName.includes('books')) {
    return 'apple_books'
  }
  if (headers.includes('selection') || headers.includes('folder')) return 'instapaper'
  if (headers.includes('book') || headers.includes('book title')) return 'apple_books'
  return 'generic_csv'
}

function defaultContentKindForSource(kind: HighlightSourceKind): HighlightContentKind {
  switch (kind) {
    case 'kindle':
    case 'apple_books':
      return 'book'
    case 'instapaper':
      return 'article'
    default:
      return 'other'
  }
}

function mapRecordToHighlight(
  record: Record<string, string>,
  sourceKind: HighlightSourceKind,
  sourceLabel: string
): CreateHighlightInput | null {
  const title = cleanTitle(pickField(record, FIELD_ALIASES.title))
  const text = normalizeWhitespace(pickField(record, FIELD_ALIASES.text) ?? '')
  if (!title || !text) return null
  return {
    sourceKind,
    sourceLabel,
    contentKind: normalizeContentKind(
      pickField(record, FIELD_ALIASES.contentKind),
      defaultContentKindForSource(sourceKind)
    ),
    sourceTitle: title,
    sourceAuthor: pickField(record, FIELD_ALIASES.author) || null,
    sourceUrl: pickField(record, FIELD_ALIASES.url) || null,
    sourceLocation: pickField(record, FIELD_ALIASES.location) || null,
    externalId: pickField(record, FIELD_ALIASES.externalId) || null,
    text,
    note: pickField(record, FIELD_ALIASES.note) ?? '',
    tags: splitTags(pickField(record, FIELD_ALIASES.tags)),
    highlightedAt: normalizeDate(pickField(record, FIELD_ALIASES.date))
  }
}

function parseKindleClippings(raw: string): CreateHighlightInput[] {
  const blocks = raw
    .split(/={10,}/)
    .map((block) => normalizeWhitespace(block))
    .filter(Boolean)
  const out: CreateHighlightInput[] = []
  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    if (lines.length < 3) continue
    const titleLine = lines[0]
    const metaLine = lines[1]
    const text = normalizeWhitespace(lines.slice(2).join('\n'))
    if (!text) continue
    const titleMatch = titleLine.match(/^(.*?)(?:\s+\(([^()]+)\))?$/)
    const title = cleanTitle(titleMatch?.[1] ?? titleLine)
    const author = titleMatch?.[2]?.trim() || null
    const page = metaLine.match(/page\s+([^|]+)/i)?.[1]?.trim()
    const location = metaLine.match(/location\s+([^|]+)/i)?.[1]?.trim()
    const addedOn = metaLine.match(/Added on\s+(.+)$/i)?.[1]?.trim()
    const locationLabel = [page ? `page ${page}` : null, location ? `location ${location}` : null]
      .filter(Boolean)
      .join(' | ')
    if (!title) continue
    out.push({
      sourceKind: 'kindle',
      sourceLabel: sourceLabelForKind('kindle'),
      contentKind: 'book',
      sourceTitle: title,
      sourceAuthor: author,
      sourceLocation: locationLabel || null,
      text,
      highlightedAt: normalizeDate(addedOn)
    })
  }
  return out
}

function parseAppleBooksText(raw: string): CreateHighlightInput[] {
  const blocks = raw
    .split(/\n{2,}/)
    .map((block) => normalizeWhitespace(block))
    .filter(Boolean)
  const out: CreateHighlightInput[] = []
  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    if (lines.length < 3) continue
    const labeled: Record<string, string> = {}
    for (const line of lines) {
      const match = line.match(/^([A-Za-z ]+):\s*(.+)$/)
      if (match) labeled[match[1].trim().toLowerCase()] = match[2].trim()
    }
    const title = cleanTitle(labeled['title'] ?? lines[0])
    const text =
      normalizeWhitespace(labeled['highlight'] ?? labeled['text'] ?? lines.slice(2).join('\n')) || ''
    if (!title || !text) continue
    const second = lines[1].toLowerCase()
    const looksLikeBooks = second.includes('page') || second.includes('location') || second.includes('highlight')
    if (!looksLikeBooks && !labeled['title']) continue
    out.push({
      sourceKind: 'apple_books',
      sourceLabel: sourceLabelForKind('apple_books'),
      contentKind: 'book',
      sourceTitle: title,
      sourceAuthor: labeled['author'] ?? null,
      sourceLocation: labeled['location'] ?? lines[1],
      text,
      note: labeled['note'] ?? '',
      tags: splitTags(labeled['tags']),
      highlightedAt: normalizeDate(labeled['date'] ?? labeled['added on'])
    })
  }
  return out
}

function parseCsvImport(fileName: string, raw: string): ParsedHighlightImport {
  const rows = csvRowsFrom(raw)
  if (rows.length === 0) {
    throw new Error('The CSV file did not contain any rows.')
  }
  const sourceKind = detectCsvSourceKind(fileName, rows)
  const sourceLabel = sourceLabelForKind(sourceKind)
  const items = rows
    .map((row) => mapRecordToHighlight(row, sourceKind, sourceLabel))
    .filter((row): row is CreateHighlightInput => row !== null)
  if (items.length === 0) {
    throw new Error('Could not find any usable highlight rows in that CSV file.')
  }
  return { sourceKind, sourceLabel, items }
}

function parseJsonImport(fileName: string, raw: string): ParsedHighlightImport {
  const parsed = JSON.parse(raw) as unknown
  const itemsRaw = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { highlights?: unknown[] }).highlights)
      ? (parsed as { highlights: unknown[] }).highlights
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown[] }).items)
        ? (parsed as { items: unknown[] }).items
        : []
  if (itemsRaw.length === 0) {
    throw new Error('The JSON file did not contain a highlights array.')
  }
  const lowerName = fileName.toLowerCase()
  const sourceKind: HighlightSourceKind = lowerName.includes('instapaper')
    ? 'instapaper'
    : lowerName.includes('apple') || lowerName.includes('ibooks') || lowerName.includes('books')
      ? 'apple_books'
      : lowerName.includes('kindle')
        ? 'kindle'
        : 'generic_json'
  const sourceLabel = sourceLabelForKind(sourceKind)
  const items = itemsRaw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => normalizeRecordKeys(item))
    .map((item) => mapRecordToHighlight(item, sourceKind, sourceLabel))
    .filter((item): item is CreateHighlightInput => item !== null)
  if (items.length === 0) {
    throw new Error('Could not find any usable highlight objects in that JSON file.')
  }
  return { sourceKind, sourceLabel, items }
}

export function parseHighlightImport(fileName: string, raw: string): ParsedHighlightImport {
  const ext = extensionOf(fileName)
  if (ext === 'csv') return parseCsvImport(fileName, raw)
  if (ext === 'json') return parseJsonImport(fileName, raw)

  const kindleItems = parseKindleClippings(raw)
  if (kindleItems.length > 0) {
    return {
      sourceKind: 'kindle',
      sourceLabel: sourceLabelForKind('kindle'),
      items: kindleItems
    }
  }

  const appleItems = parseAppleBooksText(raw)
  if (appleItems.length > 0) {
    return {
      sourceKind: 'apple_books',
      sourceLabel: sourceLabelForKind('apple_books'),
      items: appleItems
    }
  }

  throw new Error(
    'Unsupported highlight export. Try Kindle clippings, an Instapaper CSV, or a generic CSV/JSON export.'
  )
}
