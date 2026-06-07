import OpenAI from 'openai'
import type {
  RankedPassage,
  SynthesisMode,
  SynthesisRequest,
  SynthesisResult,
  SynthesisSubClaim
} from '@shared/types/database'
import { getDecryptedOpenaiKey, getOpenaiBaseUrl, readSettings } from '../settingsService'
import { runThesisSearch } from '../thesis/thesisSearchService'
import { buildMockSynthesis, toEvidence } from './synthesisMock'

// Cross-document synthesis. Retrieval is REAL (the BM25 thesis index); the model
// only ORGANIZES the gathered passages into sub-claims — we attach the real
// quotes + citations from each RankedPassage, so citations never depend on the
// model reproducing them. Mock and real return the identical structure. The
// pure mock/mappers live in synthesisMock.ts (electron-free, unit-tested).

const MAX_PASSAGES = 20
const MAX_TOKENS = 2_000

function gatherPassages(request: SynthesisRequest): RankedPassage[] {
  return runThesisSearch({
    thesis: request.thesis,
    scope: request.scope,
    activeDocumentId: request.activeDocumentId,
    limit: MAX_PASSAGES
  }).passages
}

interface RawSynthesis {
  subClaims?: Array<{ claim?: string; evidencePassageIds?: string[] }>
  tensions?: string[]
  summary?: string
}

const SHARED_RULES = [
  'You are given a thesis and a numbered list of passages (each like "P3: <text> — Source, p. N").',
  'Reference passages ONLY by their id (e.g. "P3"); never invent passages or facts not present.',
  'Return ONLY a JSON object with this exact shape:',
  '{"subClaims":[{"claim":string,"evidencePassageIds":string[]}],"tensions":string[],"summary":string}'
].join(' ')

const SUPPORT_PROMPT = [
  'You assemble a cross-document argument FOR a thesis from supplied passages.',
  'Group the passages into 2–5 coherent sub-claims that each support the thesis.',
  'Note any genuine tensions or disagreements between sources.',
  SHARED_RULES
].join(' ')

const COUNTER_PROMPT = [
  'You are a sharp opponent assembling the strongest case AGAINST a thesis from the supplied passages.',
  'Surface 2–5 counter-arguments / rebuttals — each a sub-claim that challenges, complicates, or contradicts the thesis, backed only by the passages that genuinely support that opposing point.',
  'Steelman the other side honestly; do not strawman. In "tensions", note where the passages are ambiguous or could still be read in the thesis’s favor.',
  'In "summary", give a one-paragraph rebuttal the author should pre-empt.',
  SHARED_RULES
].join(' ')

async function generateRealSynthesis(
  thesis: string,
  passages: RankedPassage[],
  mode: SynthesisMode
): Promise<SynthesisResult> {
  if (passages.length === 0) return buildMockSynthesis(thesis, passages, mode)
  const key = getDecryptedOpenaiKey()
  if (!key) return buildMockSynthesis(thesis, passages, mode)

  const settings = readSettings()
  const byId = new Map(passages.map((p, i) => [`P${i + 1}`, p]))
  const passageList = passages
    .map((p, i) => `P${i + 1}: ${p.snippet} — ${p.documentTitle}, p. ${p.pageNumber}`)
    .join('\n')

  const client = new OpenAI({
    apiKey: key,
    timeout: 60_000,
    baseURL: getOpenaiBaseUrl() ?? undefined
  })

  const userLead =
    mode === 'counter'
      ? `Thesis to challenge: ${thesis}`
      : `Thesis: ${thesis}`

  let raw: string | null | undefined
  try {
    const completion = await client.chat.completions.create({
      model: settings.openaiModel,
      temperature: 0.2,
      max_completion_tokens: MAX_TOKENS,
      // json_object is supported broadly (OpenAI, Groq, OpenRouter, Ollama),
      // unlike strict json_schema — keeps free providers working.
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: mode === 'counter' ? COUNTER_PROMPT : SUPPORT_PROMPT },
        { role: 'user', content: `${userLead}\n\nPassages:\n${passageList}` }
      ]
    })
    raw = completion.choices?.[0]?.message?.content
  } catch (err) {
    console.error('[fuzzy synthesis] model request failed; falling back to mock', err)
    return buildMockSynthesis(thesis, passages, mode)
  }

  if (!raw) return buildMockSynthesis(thesis, passages, mode)
  let parsed: RawSynthesis
  try {
    parsed = JSON.parse(raw) as RawSynthesis
  } catch (err) {
    console.error('[fuzzy synthesis] unparseable model JSON; falling back', err)
    return buildMockSynthesis(thesis, passages, mode)
  }

  const subClaims: SynthesisSubClaim[] = (parsed.subClaims ?? [])
    .map((sc) => ({
      claim: typeof sc.claim === 'string' ? sc.claim : '',
      evidence: (sc.evidencePassageIds ?? [])
        .map((id) => byId.get(id))
        .filter((p): p is RankedPassage => !!p)
        .map(toEvidence)
    }))
    .filter((sc) => sc.claim && sc.evidence.length > 0)

  // If the model produced nothing usable, fall back so the user still gets value.
  if (subClaims.length === 0) return buildMockSynthesis(thesis, passages, mode)

  return {
    thesis,
    subClaims,
    tensions: Array.isArray(parsed.tensions) ? parsed.tensions.filter((t) => typeof t === 'string') : [],
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    consideredPassageCount: passages.length
  }
}

export async function generateSynthesis(request: SynthesisRequest): Promise<SynthesisResult> {
  const passages = gatherPassages(request)
  const mode: SynthesisMode = request.mode === 'counter' ? 'counter' : 'support'
  const settings = readSettings()
  if (settings.providerMode === 'openai' && getDecryptedOpenaiKey()) {
    return generateRealSynthesis(request.thesis, passages, mode)
  }
  return buildMockSynthesis(request.thesis, passages, mode)
}
