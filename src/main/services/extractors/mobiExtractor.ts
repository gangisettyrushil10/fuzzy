// MOBI text extractor. Implemented by the MOBI agent.
//
// Contract: given the on-disk path to a .mobi, return an ExtractedDocument
// whose `pages` are readable sections. MOBI is a Palm Database (PDB) container;
// classic MOBI uses PalmDOC (LZ77-ish) compression. Implement a pure-TS
// PalmDOC reader (no native deps) to recover the HTML record, strip tags to
// text, and chunk via ./sectionUtils. KF8/AZW3-only files may be out of scope —
// fail gracefully with a clear error if compression/format is unsupported. Do
// NOT edit shared files — when this works, tell the parent to flip
// `extractorReady` for 'mobi' in '@shared/formats'.

import { readFile } from 'node:fs/promises'

import type { ExtractedDocument } from '@shared/types/database'
import { plainTextToDocument } from './sectionUtils'

// PalmDOC / MOBI compression markers (uint16 BE at start of record 0).
const COMPRESSION_NONE = 1
const COMPRESSION_PALMDOC = 2
const COMPRESSION_HUFF_CDIC = 17480 // 0x4448 ("DH")

const PDB_HEADER_NUM_RECORDS_OFFSET = 76 // 0x4C, uint16 BE
const PDB_RECORD_LIST_OFFSET = 78 // 0x4E, 8 bytes per entry

interface PdbRecord {
  start: number
  end: number
}

// Parses the PDB record info list into [start, end) byte ranges over `buf`.
function parsePdbRecords(buf: Buffer): PdbRecord[] {
  if (buf.length < PDB_RECORD_LIST_OFFSET + 8) {
    throw new Error('File is too small to be a valid MOBI/PDB container.')
  }
  const numRecords = buf.readUInt16BE(PDB_HEADER_NUM_RECORDS_OFFSET)
  if (numRecords === 0) {
    throw new Error('MOBI container has no records.')
  }

  const offsets: number[] = []
  for (let i = 0; i < numRecords; i++) {
    const entryOffset = PDB_RECORD_LIST_OFFSET + i * 8
    if (entryOffset + 4 > buf.length) {
      throw new Error('MOBI record info list is truncated.')
    }
    offsets.push(buf.readUInt32BE(entryOffset))
  }

  const records: PdbRecord[] = []
  for (let i = 0; i < offsets.length; i++) {
    const start = offsets[i]
    const end = i + 1 < offsets.length ? offsets[i + 1] : buf.length
    // Clamp to sane bounds; some files have a final record offset == file size.
    records.push({
      start: Math.min(start, buf.length),
      end: Math.min(Math.max(end, start), buf.length)
    })
  }
  return records
}

// PalmDOC (LZ77) decompression. Returns the decompressed bytes for one record.
function decompressPalmDoc(input: Buffer): Buffer {
  const out: number[] = []
  let i = 0
  const len = input.length
  while (i < len) {
    const c = input[i++]
    if (c === 0x00) {
      // Literal NUL.
      out.push(0x00)
    } else if (c >= 0x01 && c <= 0x08) {
      // Copy the next c bytes literally.
      for (let n = 0; n < c && i < len; n++) {
        out.push(input[i++])
      }
    } else if (c >= 0x09 && c <= 0x7f) {
      // Literal byte.
      out.push(c)
    } else if (c >= 0x80 && c <= 0xbf) {
      // 2-byte LZ77 reference.
      if (i >= len) break
      const value = ((c << 8) | input[i++]) & 0xffff
      const distance = (value >> 3) & 0x07ff
      const length = (value & 0x07) + 3
      if (distance === 0) continue
      let srcPos = out.length - distance
      if (srcPos < 0) continue
      // Copy byte-by-byte so overlapping (run-length) copies work.
      for (let n = 0; n < length; n++) {
        out.push(out[srcPos++])
      }
    } else {
      // 0xC0–0xFF: space followed by (c ^ 0x80).
      out.push(0x20)
      out.push(c ^ 0x80)
    }
  }
  return Buffer.from(out)
}

// Decodes HTML entities commonly found in MOBI HTML payloads.
function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&mdash;/gi, '\u2014')
    .replace(/&ndash;/gi, '\u2013')
    .replace(/&hellip;/gi, '\u2026')
    .replace(/&rsquo;/gi, '\u2019')
    .replace(/&lsquo;/gi, '\u2018')
    .replace(/&rdquo;/gi, '\u201d')
    .replace(/&ldquo;/gi, '\u201c')
}

function safeFromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return ''
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}

// Strips HTML to readable plain text: drops script/style, turns block-level
// tags into newlines, removes remaining tags, and decodes entities.
function htmlToText(html: string): string {
  let text = html
    .replace(/<\s*(script|style|head)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Line breaks.
    .replace(/<\s*br\b[^>]*\/?\s*>/gi, '\n')
    .replace(/<\s*hr\b[^>]*\/?\s*>/gi, '\n')
    // Block-level closings/openings become paragraph breaks.
    .replace(
      /<\s*\/?\s*(p|div|h[1-6]|li|ul|ol|blockquote|section|article|tr|table|pre|figure|figcaption|header|footer)\b[^>]*>/gi,
      '\n\n'
    )
    // Mobipocket page breaks.
    .replace(/<\s*mbp:pagebreak\b[^>]*\/?\s*>/gi, '\n\n')
    // Any remaining tags.
    .replace(/<[^>]+>/g, '')

  text = decodeEntities(text)

  // Collapse excessive whitespace while preserving paragraph breaks.
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text
}

export async function extractMobi(filePath: string): Promise<ExtractedDocument> {
  const buf = await readFile(filePath)

  const records = parsePdbRecords(buf)
  const record0 = buf.subarray(records[0].start, records[0].end)
  if (record0.length < 16) {
    throw new Error('MOBI PalmDOC header is too small or corrupt.')
  }

  const compression = record0.readUInt16BE(0)
  if (compression === COMPRESSION_HUFF_CDIC) {
    throw new Error('This MOBI uses an unsupported compression (HUFF/CDIC) or is KF8-only.')
  }
  if (compression !== COMPRESSION_NONE && compression !== COMPRESSION_PALMDOC) {
    throw new Error(`This MOBI uses an unsupported compression (${compression}) or is KF8-only.`)
  }

  // Number of text records (PalmDOC record count, uint16 BE at offset 8).
  const textRecordCount = record0.readUInt16BE(8)

  // Determine how many text records are available. Text records are records
  // 1..textRecordCount (record 0 is the header).
  const lastTextRecordIndex = Math.min(textRecordCount, records.length - 1)
  if (lastTextRecordIndex < 1) {
    throw new Error('This MOBI has no readable PalmDOC text records (it may be KF8-only).')
  }

  const chunks: Buffer[] = []
  for (let i = 1; i <= lastTextRecordIndex; i++) {
    const rec = records[i]
    const data = buf.subarray(rec.start, rec.end)
    if (data.length === 0) continue
    const decompressed =
      compression === COMPRESSION_PALMDOC ? decompressPalmDoc(data) : Buffer.from(data)
    chunks.push(decompressed)
  }

  const rawBytes = Buffer.concat(chunks)
  if (rawBytes.length === 0) {
    throw new Error('This MOBI produced no text (it may be KF8-only or empty).')
  }

  // Classic MOBIs are usually UTF-8 or cp1252; UTF-8 decoding handles the
  // common case and degrades gracefully for stray bytes.
  const html = rawBytes.toString('utf8')
  const text = htmlToText(html)

  if (text.trim() === '') {
    throw new Error('This MOBI produced no readable text after decoding.')
  }

  return plainTextToDocument(text)
}
