// Plain-text and Markdown extractors. Implemented by the TXT+MD agent.
//
// Contract: read the file and return an ExtractedDocument. For .txt, chunk the
// raw text with plainTextToDocument. For .md, we normalize Markdown to clean
// readable plain text (via the `marked` lexer) before chunking.
// Use ./sectionUtils. Do NOT edit shared files — when these work, tell the
// parent to flip `extractorReady` for 'txt' and 'md' in '@shared/formats'.

import { readFile } from 'fs/promises'
import type { ExtractedDocument } from '@shared/types/database'
import { plainTextToDocument } from './sectionUtils'

export async function extractTxt(filePath: string): Promise<ExtractedDocument> {
  const text = await readTextFile(filePath)
  return plainTextToDocument(text)
}

export async function extractMarkdown(filePath: string): Promise<ExtractedDocument> {
  const md = await readTextFile(filePath)
  const cleanText = await markdownToReadableText(md)
  return plainTextToDocument(cleanText)
}

async function readTextFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf-8')
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to read text file "${filePath}": ${reason}`)
  }
}

// Loose token shapes — `marked` is imported dynamically (ESM-only), so we walk
// its lexer output structurally rather than depending on its exported types.
interface InlineToken {
  type: string
  text?: string
  tokens?: InlineToken[]
  items?: BlockToken[]
}

interface BlockToken extends InlineToken {
  depth?: number
  ordered?: boolean
  start?: number | ''
  lang?: string
}

// Turns Markdown into plain text that reads naturally: heading markers are
// dropped (text kept on its own line), emphasis is stripped, links collapse to
// their visible text, images are dropped, list items keep their text, and code
// keeps its content without the fences/backticks.
async function markdownToReadableText(md: string): Promise<string> {
  const { marked } = await import('marked')
  const tokens = marked.lexer(md) as unknown as BlockToken[]
  const blocks = tokens.map((t) => renderBlock(t)).filter((s) => s.trim() !== '')
  return blocks
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function renderBlock(token: BlockToken): string {
  switch (token.type) {
    case 'space':
    case 'hr':
      return ''
    case 'heading':
    case 'paragraph':
      return renderInline(token.tokens ?? []).trim()
    case 'text':
      return token.tokens ? renderInline(token.tokens).trim() : (token.text ?? '').trim()
    case 'blockquote':
      return (token.tokens ?? [])
        .map((t) => renderBlock(t))
        .filter(Boolean)
        .join('\n\n')
    case 'code':
      return (token.text ?? '').trim()
    case 'list':
      return renderList(token)
    case 'table':
      return renderTable(token)
    case 'html':
      return stripHtml(token.text ?? '').trim()
    default:
      if (token.tokens) return renderInline(token.tokens).trim()
      return (token.text ?? '').trim()
  }
}

function renderList(list: BlockToken): string {
  const ordered = list.ordered === true
  let index = typeof list.start === 'number' ? list.start : 1
  const lines: string[] = []
  for (const item of list.items ?? []) {
    const marker = ordered ? `${index}.` : '-'
    const body = (item.tokens ?? [])
      .map((t) => renderBlock(t))
      .filter(Boolean)
      .join('\n\n')
      .replace(/\n/g, ' ')
      .trim()
    lines.push(`${marker} ${body}`.trim())
    index++
  }
  return lines.join('\n')
}

function renderTable(table: BlockToken & { header?: unknown; rows?: unknown }): string {
  const rendererCellText = (cell: { tokens?: InlineToken[]; text?: string }): string => {
    if (cell.tokens) return renderInline(cell.tokens).trim()
    return (cell.text ?? '').trim()
  }
  const header = Array.isArray(table.header)
    ? (table.header as { tokens?: InlineToken[]; text?: string }[]).map(rendererCellText)
    : []
  const rows = Array.isArray(table.rows)
    ? (table.rows as { tokens?: InlineToken[]; text?: string }[][]).map((row) =>
        row.map(rendererCellText)
      )
    : []
  const lines: string[] = []
  if (header.length) lines.push(header.join(' | '))
  for (const row of rows) lines.push(row.join(' | '))
  return lines.join('\n')
}

function renderInline(tokens: InlineToken[]): string {
  let out = ''
  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        out += token.tokens ? renderInline(token.tokens) : (token.text ?? '')
        break
      case 'strong':
      case 'em':
      case 'del':
        out += token.tokens ? renderInline(token.tokens) : (token.text ?? '')
        break
      case 'codespan':
        out += token.text ?? ''
        break
      case 'link':
        out += token.tokens ? renderInline(token.tokens) : (token.text ?? '')
        break
      case 'image':
        // Drop images entirely; alt text is rarely useful prose.
        break
      case 'br':
        out += '\n'
        break
      case 'html':
        out += stripHtml(token.text ?? '')
        break
      default:
        out += token.tokens ? renderInline(token.tokens) : (token.text ?? '')
        break
    }
  }
  return out
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
