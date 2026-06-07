import OpenAI from 'openai'
import type { ChapterSummariesResult, DigestResult } from '@shared/types/summary'
import { getDocument } from '../../db/repositories/documentRepository'
import { listPagesForDocument } from '../../db/repositories/pageRepository'
import { getDecryptedOpenaiKey, getOpenaiBaseUrl, readSettings } from '../settingsService'
import {
  buildMockChapterSummaries,
  buildMockDigest,
  segmentChapters,
  targetWordsForMinutes,
  type Chapter
} from './summaryMock'

// Time-budgeted digest + per-chapter SparkNotes. Retrieval/segmentation is
// local; the model only writes prose. Mock and real share the structure (see
// summaryMock). Compute-on-demand — nothing is persisted.

const MAX_INPUT_CHARS = 12_000
const CHAPTER_TEXT_CHARS = 700

function representativeSlice(documentId: string): { title: string; slice: string } | null {
  const doc = getDocument(documentId)
  if (!doc) return null
  const pages = listPagesForDocument(documentId)
    .filter((p) => (p.textContent ?? '').trim().length > 0)
    .sort((a, b) => a.pageNumber - b.pageNumber)
  if (pages.length === 0) return { title: doc.title, slice: '' }

  const total = pages.reduce((s, p) => s + (p.textContent?.length ?? 0), 0)
  if (total <= MAX_INPUT_CHARS) {
    return { title: doc.title, slice: pages.map((p) => p.textContent ?? '').join('\n\n') }
  }
  const stride = Math.max(1, Math.floor(pages.length / 24))
  let acc = ''
  for (let i = 0; i < pages.length; i += stride) {
    const chunk = pages[i].textContent ?? ''
    if (acc.length + chunk.length > MAX_INPUT_CHARS) break
    acc += (acc ? '\n\n' : '') + chunk
  }
  return { title: doc.title, slice: acc }
}

function client(): OpenAI {
  return new OpenAI({
    apiKey: getDecryptedOpenaiKey() ?? '',
    timeout: 60_000,
    baseURL: getOpenaiBaseUrl() ?? undefined
  })
}

function useReal(): boolean {
  return readSettings().providerMode === 'openai' && !!getDecryptedOpenaiKey()
}

// ---- digest ----

export async function generateDigest(
  documentId: string,
  targetMinutes: number
): Promise<DigestResult> {
  const rep = representativeSlice(documentId)
  if (!rep) throw new Error('Document not found.')
  const targetWords = targetWordsForMinutes(targetMinutes)
  if (!rep.slice.trim() || !useReal()) {
    return buildMockDigest(documentId, rep.title, rep.slice, targetMinutes)
  }

  try {
    const completion = await client().chat.completions.create({
      model: readSettings().openaiModel,
      temperature: 0.3,
      max_completion_tokens: Math.min(3_000, Math.round(targetWords * 1.6)),
      messages: [
        {
          role: 'system',
          content:
            'You write faithful, well-structured digests of documents for a reader on a time budget. Compress to roughly the requested word count, keep the original argument order, and never invent facts not in the provided text.'
        },
        {
          role: 'user',
          content: [
            `Title: ${rep.title}`,
            `Write a ~${targetWords}-word digest (about a ${targetMinutes}-minute read).`,
            '',
            'Document text (may be a representative sample of a longer work):',
            rep.slice
          ].join('\n')
        }
      ]
    })
    const text = completion.choices?.[0]?.message?.content?.trim()
    if (!text) return buildMockDigest(documentId, rep.title, rep.slice, targetMinutes)
    return { documentId, targetMinutes, targetWords, text }
  } catch (err) {
    console.error('[fuzzy digest] model request failed; falling back to mock', err)
    return buildMockDigest(documentId, rep.title, rep.slice, targetMinutes)
  }
}

// ---- chapter summaries ----

interface RawChapters {
  summaries?: Array<{ index?: number; summary?: string }>
}

function chapterList(documentId: string): Chapter[] {
  const doc = getDocument(documentId)
  if (!doc) return []
  return segmentChapters(listPagesForDocument(documentId), doc.fileType)
}

export async function generateChapterSummaries(
  documentId: string
): Promise<ChapterSummariesResult> {
  const chapters = chapterList(documentId)
  if (chapters.length === 0 || !useReal()) {
    return buildMockChapterSummaries(documentId, chapters)
  }

  // One call: send a compact, truncated list; the model returns a summary per
  // chapter index. We attach titles/anchors locally so they're always correct.
  const listText = chapters
    .map((c) => `C${c.index}: ${c.text.replace(/\s+/g, ' ').trim().slice(0, CHAPTER_TEXT_CHARS)}`)
    .join('\n\n')

  try {
    const completion = await client().chat.completions.create({
      model: readSettings().openaiModel,
      temperature: 0.3,
      max_completion_tokens: Math.min(3_000, 120 * chapters.length + 200),
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You write concise "SparkNotes"-style chapter recaps (2–3 sentences each), grounded only in the supplied text. Return ONLY JSON: {"summaries":[{"index":number,"summary":string}]} with one entry per chapter id (C0, C1, …).'
        },
        { role: 'user', content: listText }
      ]
    })
    const raw = completion.choices?.[0]?.message?.content
    if (!raw) return buildMockChapterSummaries(documentId, chapters)
    const parsed = JSON.parse(raw) as RawChapters
    const byIndex = new Map((parsed.summaries ?? []).map((s) => [s.index, s.summary]))
    return {
      documentId,
      chapters: chapters.map((c) => ({
        index: c.index,
        title: c.title,
        pageNumber: c.pageNumber,
        summary:
          typeof byIndex.get(c.index) === 'string' && byIndex.get(c.index)!.trim()
            ? byIndex.get(c.index)!.trim()
            : '(no summary returned)'
      }))
    }
  } catch (err) {
    console.error('[fuzzy chapters] model request failed; falling back to mock', err)
    return buildMockChapterSummaries(documentId, chapters)
  }
}
