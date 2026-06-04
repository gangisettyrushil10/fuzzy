import OpenAI from 'openai'
import type {
  DocumentRecord,
  Flashcard,
  PageRecord,
  QuizQuestion,
  StudyPackRecord
} from '@shared/types/database'
import { getDecryptedOpenaiKey, readSettings } from './settingsService'
import { insertStudyPack } from '../db/repositories/studyPackRepository'

// Hard cap on how much of the document we ship to the model. ~12k chars is
// well under gpt-4o-mini's context window and keeps a single study-pack
// call inside the ~$0.005 input ballpark.
const MAX_INPUT_CHARS = 12_000
const MAX_COMPLETION_TOKENS = 1_400

export interface GenerateStudyPackInput {
  document: DocumentRecord
  pages: PageRecord[]
}

// Build a representative slice of the document. For short docs we ship the
// whole thing; for long docs we sample evenly across the table of contents
// so a 200-page paper still produces a study pack that spans the argument.
function selectRepresentativeSlice(pages: PageRecord[]): string {
  const usable = pages
    .filter((p) => (p.textContent ?? '').trim().length > 0)
    .sort((a, b) => a.pageNumber - b.pageNumber)
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

// Mock pack — deterministic, derived from the document title + first page.
function buildMockPack(document: DocumentRecord, pages: PageRecord[]): StudyPackRecord {
  const firstWithText = pages.find((p) => (p.textContent ?? '').trim().length > 0)
  const preview = (firstWithText?.textContent ?? document.title).slice(0, 160)
  const summary = `Mock study pack for "${document.title}".\n\nKey idea: ${preview} …\n\nThis is the offline-mode summary. Switch to OpenAI in Settings for a real study pack.`
  const flashcards: Flashcard[] = [
    { question: `What is the main subject of "${document.title}"?`, answer: preview },
    {
      question: 'What follow-up reading would deepen this topic?',
      answer: 'The next chapter or a citing paper.'
    }
  ]
  const quiz: QuizQuestion[] = [
    {
      question: `In one sentence, what is "${document.title}" arguing?`,
      answer: 'It argues the central claim laid out on the first page.',
      difficulty: 'easy'
    },
    {
      question: 'Name one piece of evidence the author leans on.',
      answer: 'The supporting paragraph that follows the main claim.',
      difficulty: 'medium'
    }
  ]
  return insertStudyPack({
    documentId: document.id,
    title: document.title,
    summary,
    flashcards,
    quiz,
    keyConcepts: ['mock-key-concept-1', 'mock-key-concept-2']
  })
}

interface RawPack {
  summary: string
  keyConcepts: string[]
  flashcards: Array<{ question: string; answer: string }>
  quiz: Array<{ question: string; answer: string; difficulty?: string }>
}

const STUDY_PACK_SCHEMA = {
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
          answer: { type: 'string' }
        },
        required: ['question', 'answer']
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
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] }
        },
        required: ['question', 'answer', 'difficulty']
      }
    }
  },
  required: ['summary', 'keyConcepts', 'flashcards', 'quiz']
} as const

function normaliseDifficulty(raw: string | undefined): QuizQuestion['difficulty'] {
  return raw === 'easy' || raw === 'medium' || raw === 'hard' ? raw : 'medium'
}

async function generateOpenAiPack(
  document: DocumentRecord,
  pages: PageRecord[]
): Promise<StudyPackRecord> {
  const key = getDecryptedOpenaiKey()
  if (!key) throw new Error('No OpenAI key configured.')
  const settings = readSettings()
  const slice = selectRepresentativeSlice(pages)
  if (!slice) throw new Error('No extractable text in this document yet.')

  const client = new OpenAI({ apiKey: key, timeout: 60_000 })

  const completion = await client.chat.completions.create({
    model: settings.openaiModel,
    temperature: 0.2,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'fuzzy_study_pack',
        strict: true,
        schema: STUDY_PACK_SCHEMA
      }
    },
    messages: [
      {
        role: 'system',
        content:
          'You generate study packs for serious readers. Stay grounded in the supplied document slice. Do not invent facts not present in the slice. Use compact, faithful summaries. Return JSON that matches the supplied schema exactly.'
      },
      {
        role: 'user',
        content: [
          `Document title: ${document.title}`,
          '',
          'Document slice (representative pages):',
          slice
        ].join('\n')
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
    flashcards: (parsed.flashcards ?? []).map((f) => ({ question: f.question, answer: f.answer })),
    quiz: (parsed.quiz ?? []).map((q) => ({
      question: q.question,
      answer: q.answer,
      difficulty: normaliseDifficulty(q.difficulty)
    })),
    keyConcepts: parsed.keyConcepts ?? []
  })
}

export async function generateStudyPack(input: GenerateStudyPackInput): Promise<StudyPackRecord> {
  const settings = readSettings()
  if (settings.providerMode === 'openai' && getDecryptedOpenaiKey()) {
    return generateOpenAiPack(input.document, input.pages)
  }
  return buildMockPack(input.document, input.pages)
}
