/**
 * Standalone EPUB seed script.
 * Extracts chapters from an EPUB and inserts them as pages into fuzzy.db.
 * Runs outside Electron using system Node — no Electron APIs required.
 *
 * Usage: node scripts/seed-epub.mjs <epub-path> <document-id> [db-path]
 */
import { readFile } from 'fs/promises'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import { execSync } from 'child_process'
import os from 'os'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const require = createRequire(import.meta.url)
const JSZip = require(path.join(ROOT, 'node_modules/jszip'))

const EPUB_PATH = process.argv[2] ?? '/tmp/great-gatsby.epub'
const DOC_ID = process.argv[3] ?? 'gatsby-epub-001'
const DB_PATH =
  process.argv[4] ?? path.join(os.homedir(), 'Library/Application Support/fuzzy/fuzzy.db')

// ---- Minimal HTML-to-text (mirrors epubExtractor.ts htmlToText) ----
function htmlToText(html) {
  let text = html
  text = text.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<!--[\s\S]*?-->/g, '')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  const blockTags =
    'address|article|aside|blockquote|div|dl|dd|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tr|ul'
  text = text.replace(new RegExp(`</(?:${blockTags})>`, 'gi'), '\n\n')
  text = text.replace(new RegExp(`<(?:${blockTags})\\b[^>]*>`, 'gi'), '\n')
  text = text.replace(/<[^>]+>/g, '')
  text = decodeEntities(text)
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  text = text.replace(/[ \t\f\v]+/g, ' ')
  text = text.replace(/ *\n */g, '\n')
  text = text.replace(/\n{3,}/g, '\n\n')
  return text.trim()
}

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }
function decodeEntities(t) {
  return t.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (whole, body) => {
    const l = body.toLowerCase()
    if (l[0] === '#') {
      const cp = l[1] === 'x' ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10)
      if (Number.isFinite(cp) && cp > 0) {
        try {
          return String.fromCodePoint(cp)
        } catch {
          return whole
        }
      }
      return whole
    }
    return Object.prototype.hasOwnProperty.call(NAMED, l) ? NAMED[l] : whole
  })
}

// ---- Minimal EPUB spine parsing ----
function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))
  return m ? m[1] : null
}

function normalizeZipPath(p) {
  return p.replace(/\\/g, '/').replace(/^\.\//, '')
}
function dirname(p) {
  const i = p.lastIndexOf('/')
  return i === -1 ? '' : p.slice(0, i)
}
function resolvePath(base, href) {
  const clean = normalizeZipPath(decodeURIComponent(href).split('#')[0])
  if (clean.startsWith('/')) return clean.slice(1)
  const parts = (base ? base.split('/') : []).concat(clean.split('/'))
  const stack = []
  for (const p of parts) {
    if (p === '' || p === '.') continue
    if (p === '..') stack.pop()
    else stack.push(p)
  }
  return stack.join('/')
}

async function readZipText(zip, p) {
  let entry = zip.file(p)
  if (!entry) {
    const lower = p.toLowerCase()
    zip.forEach((rel, f) => {
      if (!entry && rel.toLowerCase() === lower) entry = f
    })
  }
  return entry ? entry.async('string') : null
}

// ---- Extraction ----
async function extractEpub(filePath) {
  const zip = await JSZip.loadAsync(await readFile(filePath))

  const container = await readZipText(zip, 'META-INF/container.xml')
  if (!container) throw new Error('No META-INF/container.xml')

  const opfPath = normalizeZipPath(
    container.match(/<rootfile\b[^>]*\bfull-path\s*=\s*["']([^"']+)["']/i)?.[1] ?? ''
  )
  if (!opfPath) throw new Error('No OPF path in container.xml')

  const opfXml = await readZipText(zip, opfPath)
  if (!opfXml) throw new Error(`OPF not found: ${opfPath}`)

  const opfDir = dirname(opfPath)

  // Parse manifest
  const manifest = new Map()
  const manifestBlock = opfXml.match(/<manifest\b[^>]*>([\s\S]*?)<\/manifest>/i)?.[1] ?? opfXml
  for (const m of manifestBlock.matchAll(/<item\b[^>]*>/gi)) {
    const id = attr(m[0], 'id'),
      href = attr(m[0], 'href')
    if (id && href) manifest.set(id, decodeEntities(href))
  }

  // Parse spine
  const spineBlock = opfXml.match(/<spine\b[^>]*>([\s\S]*?)<\/spine>/i)?.[1] ?? ''
  const spine = [...spineBlock.matchAll(/<itemref\b[^>]*>/gi)]
    .map((m) => attr(m[0], 'idref'))
    .filter(Boolean)

  const sections = []
  for (const idref of spine) {
    const href = manifest.get(idref)
    if (!href) continue
    const docPath = resolvePath(opfDir, href)
    const xhtml = await readZipText(zip, docPath)
    if (!xhtml) continue
    const text = htmlToText(xhtml)
    if (text.length < 20) continue // skip nav/toc pages
    sections.push({ text, html: null }) // skip images for speed
  }

  return sections
}

// ---- Main ----
console.log(`Seeding EPUB: ${EPUB_PATH}`)
console.log(`Document ID: ${DOC_ID}`)
console.log(`DB: ${DB_PATH}`)

const sections = await extractEpub(EPUB_PATH)
console.log(`Extracted ${sections.length} chapters`)

const now = new Date().toISOString()
let pageNumber = 1
let insertedCount = 0

for (const { text } of sections) {
  const wordCount = text.trim() === '' ? 0 : text.split(/\s+/).filter(Boolean).length
  const id = randomUUID()
  // Escape single quotes for SQLite
  const safeText = text.replace(/'/g, "''")
  const sql = `INSERT OR REPLACE INTO pages (id, document_id, page_number, text_content, html_content, estimated_word_count, created_at) VALUES ('${id}', '${DOC_ID}', ${pageNumber}, '${safeText}', NULL, ${wordCount}, '${now}');`

  // Write to temp file to avoid shell escaping issues
  const tmpFile = `/tmp/fuzzy-seed-${pageNumber}.sql`
  fs.writeFileSync(tmpFile, sql)
  try {
    execSync(`sqlite3 "${DB_PATH}" < "${tmpFile}"`, { stdio: 'pipe' })
    insertedCount++
  } catch (e) {
    console.warn(`  page ${pageNumber} insert failed: ${e.message?.slice(0, 80)}`)
  }
  fs.unlinkSync(tmpFile)
  pageNumber++
}

// Update page_count on the document
execSync(
  `sqlite3 "${DB_PATH}" "UPDATE documents SET page_count = ${pageNumber - 1} WHERE id = '${DOC_ID}';"`
)

console.log(`Done. Inserted ${insertedCount} / ${sections.length} pages.`)
console.log(`Page count set to ${pageNumber - 1}.`)
