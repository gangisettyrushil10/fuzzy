import OpenAI from 'openai'
import type {
  DocumentRecord,
  Flashcard,
  FlashcardKind,
  PageRecord,
  QuizCategory,
  QuizFormat,
  QuizQuestion,
  StudyPackOptions,
  StudyPackRecord
} from '@shared/types/database'
import {
  DEFAULT_STUDY_PACK_OPTIONS,
  QUIZ_CATEGORIES,
  QUIZ_CATEGORY_LABELS,
  normalizeStudyPackOptions
} from '@shared/types/database'
import { getDecryptedOpenaiKey, getOpenaiBaseUrl, readSettings } from './settingsService'
import { insertStudyPack } from '../db/repositories/studyPackRepository'

// Hard cap on how much of the document we ship to the model. ~12k chars is
// well under gpt-4o-mini's context window and keeps a single study-pack
// call inside the ~$0.005 input ballpark.
const MAX_INPUT_CHARS = 12_000
// Scales with how many cards/questions the user asked for so larger packs don't
// get truncated mid-JSON.
const BASE_COMPLETION_TOKENS = 1_400

export interface GenerateStudyPackInput {
  document: DocumentRecord
  pages: PageRecord[]
}

// Build a representative slice of the document. For short docs we ship the
// whole thing; for long docs we sample evenly across the table of contents
// so a 200-page paper still produces a study pack that spans the argument.
// When `pageRange` is set (per-section packs) we restrict to that window first.
function selectRepresentativeSlice(
  pages: PageRecord[],
  pageRange?: StudyPackOptions['pageRange']
): string {
  let usable = pages
    .filter((p) => (p.textContent ?? '').trim().length > 0)
    .sort((a, b) => a.pageNumber - b.pageNumber)
  if (pageRange) {
    const scoped = usable.filter(
      (p) => p.pageNumber >= pageRange.start && p.pageNumber <= pageRange.end
    )
    // Fall back to the whole document if the range matched nothing extractable.
    if (scoped.length > 0) usable = scoped
  }
  if (usable.length === 0) return ''

  const total = usable.reduce((s, p) => s + (p.textContent?.length ?? 0), 0)
  if (total <= MAX_INPUT_CHARS) {
    return usable.map((p) => `--- page ${p.pageNumber} ---\n${p.textContent ?? ''}`).join('\n\n')
  }
  // Stride-sample: take every Nth page until we hit the cap.
  const stride = Math.max(1, Math.floor(usable.length / 24))
  const picked: PageRecord[] = []
  for (let i = 0; i < usable.length; i += stride) {
    picked.push(usable[i])
    if (picked.length >= 24) break
  }
  let acc = ''
  for (const p of picked) {
    const chunk = `--- page ${p.pageNumber} ---\n${p.textContent ?? ''}`
    if (acc.length + chunk.length > MAX_INPUT_CHARS) break
    acc += (acc ? '\n\n' : '') + chunk
  }
  return acc
}

// --------------------------------------------------------------------------
// Mock pack — deterministic, derived from the document title + first page, but
// honouring the requested options so offline mode demonstrates MCQ/cloze/etc.
// --------------------------------------------------------------------------
function mockChoicesFor(
  answer: string,
  format: QuizFormat
): { choices?: string[]; correctIndex?: number } {
  if (format === 'true_false') return { choices: ['True', 'False'], correctIndex: 0 }
  if (format === 'multiple_choice') {
    return {
      choices: [answer, 'A plausible-but-wrong option', 'Another distractor', 'None of the above'],
      correctIndex: 0
    }
  }
  return {}
}

function buildMockPack(
  document: DocumentRecord,
  pages: PageRecord[],
  options: StudyPackOptions
): StudyPackRecord {
  const firstWithText = pages.find((p) => (p.textContent ?? '').trim().length > 0)
  const preview = (firstWithText?.textContent ?? document.title).slice(0, 160)
  const summary = `Mock study pack for "${document.title}".\n\nKey idea: ${preview} …\n\nThis is the offline-mode summary. Switch to OpenAI in Settings for a real study pack.`

  const cats = options.categories.length ? options.categories : DEFAULT_STUDY_PACK_OPTIONS.categories
  const diffs = options.difficulties.length
    ? options.difficulties
    : DEFAULT_STUDY_PACK_OPTIONS.difficulties
  const fmts = options.formats.length ? options.formats : DEFAULT_STUDY_PACK_OPTIONS.formats

  const quiz: QuizQuestion[] = Array.from({ length: options.quizCount }, (_, i) => {
    const category = cats[i % cats.length]
    const difficulty = diffs[i % diffs.length]
    const format = fmts[i % fmts.length]
    const question = `(${QUIZ_CATEGORY_LABELS[category]}) Mock ${format.replace('_', ' ')} question ${
      i + 1
    } about "${document.title}"?`
    const answer = `Mock answer ${i + 1} grounded in the first page.`
    return { question, answer, difficulty, format, category, ...mockChoicesFor(answer, format) }
  })

  const flashcards: Flashcard[] = Array.from({ length: options.flashcardCount }, (_, i) => {
    if (options.includeCloze && i % 2 === 1) {
      return {
        question: `The main subject of this work is ____ (card ${i + 1}).`,
        answer: document.title,
        kind: 'cloze' as FlashcardKind
      }
    }
    return {
      question: `Mock flashcard ${i + 1}: what is a key point of "${document.title}"?`,
      answer: preview,
      kind: 'qa' as FlashcardKind
    }
  })

  return insertStudyPack({
    documentId: document.id,
    title: document.title,
    summary,
    flashcards,
    quiz,
    keyConcepts: ['mock-key-concept-1', 'mock-key-concept-2'],
    options
  })
}

// --------------------------------------------------------------------------
// OpenAI generation — dynamic schema + prompt keyed on the chosen options.
// --------------------------------------------------------------------------
interface RawPack {
  summary: string
  keyConcepts: string[]
  flashcards: Array<{ question: string; answer: string; kind?: string }>
  quiz: Array<{
    question: string
    answer: string
    difficulty?: string
    format?: string
    category?: string
    choices?: string[] | null
    correctIndex?: number | null
  }>
}

// Build a strict json_schema constrained to the user's chosen difficulties,
// formats, and categories. Strict mode requires EVERY property to be listed in
// `required`, so "optional" fields (choices/correctIndex) are nullable instead.
function buildSchema(options: StudyPackOptions): Record<string, unknown> {
  const difficulties = options.difficulties.length ? options.difficulties : ['easy', 'medium', 'hard']
  const formats = options.formats.length ? options.formats : ['short_answer']
  // Always allow 'general' as a fallback bucket alongside the chosen categories.
  const categories = [...new Set([...options.categories, 'general'])]
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      keyConcepts: { type: 'array', items: { type: 'string' } },
      flashcards: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            question: { type: 'string' },
            answer: { type: 'string' },
            kind: { type: 'string', enum: ['qa', 'cloze'] }
          },
          required: ['question', 'answer', 'kind']
        }
      },
      quiz: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            question: { type: 'string' },
            answer: { type: 'string' },
            difficulty: { type: 'string', enum: difficulties },
            format: { type: 'string', enum: formats },
            category: { type: 'string', enum: categories },
            choices: { type: ['array', 'null'], items: { type: 'string' } },
            correctIndex: { type: ['integer', 'null'] }
          },
          required: ['question', 'answer', 'difficulty', 'format', 'category', 'choices', 'correctIndex']
        }
      }
    },
    required: ['summary', 'keyConcepts', 'flashcards', 'quiz']
  }
}

function buildUserPrompt(document: DocumentRecord, slice: string, options: StudyPackOptions): string {
  const categoryList = options.categories
    .map((c) => `${c} (${QUIZ_CATEGORY_LABELS[c]})`)
    .join(', ')
  const formatList = options.formats.join(', ')
  const lines = [
    `Document title: ${document.title}`,
    document.genre ? `Detected genre: ${document.genre}` : '',
    '',
    'Generation requirements:',
    `- Produce exactly ${options.quizCount} quiz questions and ${options.flashcardCount} flashcards.`,
    `- Spread quiz difficulty across ONLY these levels: ${options.difficulties.join(', ')}.`,
    `- Use ONLY these question formats: ${formatList}.`,
    `- Each quiz question MUST be tagged with exactly one category from: ${categoryList}, or "general" if none fits.`,
    '- For multiple_choice: provide 3-4 plausible "choices" and set "correctIndex" to the right one; "answer" must equal the correct choice text.',
    '- For true_false: "choices" = ["True","False"], set "correctIndex" (0 or 1); "answer" = the correct one.',
    '- For short_answer: set "choices" and "correctIndex" to null; "answer" is the model answer.',
    options.includeCloze
      ? '- Make roughly half of the flashcards cloze (kind="cloze"): the "question" is a sentence from the text with the key term replaced by "____", and "answer" is the removed term. The rest are kind="qa".'
      : '- All flashcards are kind="qa" (question/answer).',
    options.focusNote?.trim() ? `- Emphasis from the reader: ${options.focusNote.trim()}` : '',
    options.pageRange
      ? `- The slice below is scoped to pages ${options.pageRange.start}-${options.pageRange.end}; keep everything within it.`
      : '',
    '',
    'Document slice (representative pages):',
    slice
  ]
  return lines.filter((l) => l !== '').join('\n')
}

function normaliseDifficulty(raw: string | undefined): QuizQuestion['difficulty'] {
  return raw === 'easy' || raw === 'medium' || raw === 'hard' ? raw : 'medium'
}

function normaliseFormat(raw: string | undefined): QuizFormat {
  return raw === 'multiple_choice' || raw === 'true_false' || raw === 'short_answer'
    ? raw
    : 'short_answer'
}

function normaliseCategory(raw: string | undefined): QuizCategory {
  return (QUIZ_CATEGORIES as readonly string[]).includes(raw ?? '')
    ? (raw as QuizCategory)
    : 'general'
}

// Coerce the model's quiz item into a safe QuizQuestion. MCQ/TF without valid
// choices degrade to short_answer so the runner never renders an empty option set.
function toQuizQuestion(q: RawPack['quiz'][number]): QuizQuestion {
  const format = normaliseFormat(q.format)
  const base: QuizQuestion = {
    question: q.question,
    answer: q.answer,
    difficulty: normaliseDifficulty(q.difficulty),
    category: normaliseCategory(q.category)
  }
  if ((format === 'multiple_choice' || format === 'true_false') && Array.isArray(q.choices) && q.choices.length >= 2) {
    const choices = q.choices.map((c) => String(c))
    let correctIndex =
      typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < choices.length
        ? q.correctIndex
        : choices.findIndex((c) => c.trim() === q.answer.trim())
    if (correctIndex < 0) correctIndex = 0
    return { ...base, format, choices, correctIndex, answer: choices[correctIndex] }
  }
  return { ...base, format: 'short_answer' }
}

async function generateOpenAiPack(
  document: DocumentRecord,
  pages: PageRecord[],
  options: StudyPackOptions
): Promise<StudyPackRecord> {
  const key = getDecryptedOpenaiKey()
  if (!key) throw new Error('No OpenAI key configured.')
  const settings = readSettings()
  const slice = selectRepresentativeSlice(pages, options.pageRange)
  if (!slice) throw new Error('No extractable text in this document yet.')

  const client = new OpenAI({ apiKey: key, timeout: 60_000, baseURL: getOpenaiBaseUrl() ?? undefined })
  const maxTokens = Math.min(
    4_000,
    BASE_COMPLETION_TOKENS + (options.quizCount + options.flashcardCount) * 80
  )

  const completion = await client.chat.completions.create({
    model: settings.openaiModel,
    temperature: 0.2,
    max_completion_tokens: maxTokens,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'fuzzy_study_pack',
        strict: true,
        schema: buildSchema(options)
      }
    },
    messages: [
      {
        role: 'system',
        content:
          'You generate study packs for serious readers. Stay grounded in the supplied document slice. Do not invent facts not present in the slice. Use compact, faithful summaries. Honour the generation requirements exactly (counts, difficulties, formats, categories). Return JSON that matches the supplied schema exactly.'
      },
      {
        role: 'user',
        content: buildUserPrompt(document, slice, options)
      }
    ]
  })
  const raw = completion.choices?.[0]?.message?.content
  if (!raw) throw new Error('Empty response from OpenAI.')
  let parsed: RawPack
  try {
    parsed = JSON.parse(raw) as RawPack
  } catch (err) {
    console.error('[fuzzy study-pack] failed to parse model JSON', err, raw.slice(0, 240))
    throw new Error('Could not parse the study pack response.')
  }

  return insertStudyPack({
    documentId: document.id,
    title: document.title,
    summary: parsed.summary ?? null,
    flashcards: (parsed.flashcards ?? []).map((f) => ({
      question: f.question,
      answer: f.answer,
      kind: f.kind === 'cloze' ? 'cloze' : 'qa'
    })),
    quiz: (parsed.quiz ?? []).map(toQuizQuestion),
    keyConcepts: parsed.keyConcepts ?? [],
    options
  })
}

export async function generateStudyPack(
  input: GenerateStudyPackInput,
  rawOptions?: StudyPackOptions
): Promise<StudyPackRecord> {
  const options = normalizeStudyPackOptions(rawOptions ?? DEFAULT_STUDY_PACK_OPTIONS)
  const settings = readSettings()
  if (settings.providerMode === 'openai' && getDecryptedOpenaiKey()) {
    return generateOpenAiPack(input.document, input.pages, options)
  }
  return buildMockPack(input.document, input.pages, options)
}
