// Pure argument-map helpers (no electron/openai/db imports — unit-tested).
// Heuristic, zero-cost extraction of a document's claims via assertive cue
// phrases, used as the no-key fallback. citationsFor is injected so the module
// stays pure (the service passes the real formatter).

import type {
  ArgumentClaim,
  ArgumentMapResult,
  CitationFormat,
  SynthesisEvidence
} from '@shared/types/database'

// Phrases that tend to mark an assertive claim / thesis statement.
const CLAIM_CUES = [
  'argue', 'argues', 'claim', 'claims', 'contend', 'contends', 'therefore', 'thus',
  'hence', 'demonstrates', 'shows that', 'proves', 'suggests that', 'it follows',
  'must', 'should', 'cannot', 'fundamentally', 'in essence', 'the central',
  'the main point', 'ultimately', 'crucially', 'i believe', 'we believe'
]

// Hedges that mark a claim as merely asserted rather than supported nearby.
const SUPPORT_CUES = ['because', 'since', 'evidence', 'data', 'study', 'for example', 'for instance', 'shows']

interface ClaimSentence {
  sentence: string
  pageNumber: number
  cueScore: number
}

function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+(?:["'’)\]]+)?/g) ?? []).map((s) => s.trim()).filter(Boolean)
}

export function extractClaimSentences(
  pages: Array<{ pageNumber: number; textContent: string | null }>
): ClaimSentence[] {
  const out: ClaimSentence[] = []
  for (const page of pages) {
    if (!page.textContent) continue
    for (const sentence of splitSentences(page.textContent)) {
      const lower = sentence.toLowerCase()
      const cueScore = CLAIM_CUES.reduce((n, cue) => (lower.includes(cue) ? n + 1 : n), 0)
      // Reasonable length + at least one cue → candidate claim.
      if (cueScore > 0 && sentence.length >= 40 && sentence.length <= 320) {
        out.push({ sentence, pageNumber: page.pageNumber, cueScore })
      }
    }
  }
  return out
}

function assess(sentence: string): ArgumentClaim['assessment'] {
  const lower = sentence.toLowerCase()
  if (SUPPORT_CUES.some((c) => lower.includes(c))) return 'well-supported'
  if (/\b(but|however|although|yet|critics|some argue)\b/.test(lower)) return 'contested'
  return 'asserted'
}

export interface BuildArgumentMapArgs {
  documentId: string
  documentTitle: string
  pages: Array<{ pageNumber: number; textContent: string | null }>
  citationsFor: (page: number) => Record<CitationFormat, string>
  fallbackReason: 'no_api_key' | null
  maxClaims?: number
}

export function buildLocalArgumentMap(args: BuildArgumentMapArgs): ArgumentMapResult {
  const { documentId, documentTitle, pages, citationsFor, fallbackReason } = args
  const maxClaims = args.maxClaims ?? 6
  const candidates = extractClaimSentences(pages).sort(
    (a, b) => b.cueScore - a.cueScore || a.pageNumber - b.pageNumber
  )

  if (candidates.length === 0) {
    return {
      documentId,
      thesis: '',
      claims: [],
      rhetoric: [],
      summary: 'No clearly stated claims were detected in this document.',
      fallbackReason
    }
  }

  // The most cue-dense early sentence is a reasonable thesis guess.
  const thesis = candidates[0].sentence

  const claims: ArgumentClaim[] = candidates.slice(0, maxClaims).map((c, i) => {
    const support: SynthesisEvidence[] = [
      {
        quote: c.sentence,
        documentId,
        documentTitle,
        pageNumber: c.pageNumber,
        citations: citationsFor(c.pageNumber)
      }
    ]
    return {
      id: `claim-${i}`,
      claim: c.sentence,
      support,
      assessment: assess(c.sentence),
      note: ''
    }
  })

  return {
    documentId,
    thesis,
    claims,
    rhetoric: [],
    summary: `Detected ${claims.length} candidate claim(s) by assertive phrasing.`,
    fallbackReason
  }
}
