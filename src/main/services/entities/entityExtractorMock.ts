// Pure, dependency-free local entity extraction (no electron/openai/db imports
// so it unit-tests in the node env — the synthesisMock.ts seam). Default,
// zero-cost character NER + alias clustering for fiction; the real
// entityIndexService re-uses these and optionally refines the roster with one
// cheap LLM call.

import type { ExtractedDocument, ExtractedEntity, EntityMention } from '@shared/types/database'

// Honorifics anchor a proper-name run and are a strong "this is a person" signal.
// Stored lowercased, trailing '.' stripped at compare time.
const HONORIFICS = new Set<string>([
  'mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'professor', 'sir', 'lady', 'lord',
  'madam', 'madame', 'monsieur', 'mlle', 'mme', 'captain', 'capt', 'colonel',
  'col', 'major', 'general', 'sergeant', 'sgt', 'lieutenant', 'lt', 'rev',
  'reverend', 'father', 'sister', 'brother', 'aunt', 'uncle', 'king', 'queen',
  'prince', 'princess', 'duke', 'duchess', 'count', 'countess', 'saint', 'st'
])

// Lowercase connectors that can appear inside a multi-word name ("Joan of Arc",
// "Ludwig van Beethoven"). Kept in the surface form, dropped from match tokens.
const NAME_CONNECTORS = new Set<string>([
  'of', 'the', 'de', 'van', 'von', 'der', 'den', 'du', 'da', 'di', 'la', 'le', 'el'
])

// Capitalized words that are NOT names — sentence openers, structure words,
// calendar terms. A run made only of these is dropped.
const TITLE_STOPWORDS = new Set<string>([
  'the', 'a', 'an', 'and', 'but', 'or', 'so', 'yet', 'for', 'nor', 'if', 'as',
  'at', 'in', 'on', 'of', 'to', 'from', 'with', 'by', 'into', 'onto', 'upon',
  'this', 'that', 'these', 'those', 'then', 'there', 'here', 'when', 'while',
  'where', 'what', 'why', 'how', 'who', 'whom', 'which', 'he', 'she', 'it',
  'they', 'we', 'you', 'i', 'his', 'her', 'their', 'our', 'your', 'my', 'its',
  'him', 'them', 'us', 'me', 'chapter', 'part', 'book', 'volume', 'section',
  'page', 'yes', 'no', 'oh', 'ah', 'well', 'now', 'thus', 'hence', 'however',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december'
])

interface RawCandidate {
  surfaceForm: string // best (most frequent) display form
  significantTokens: string[] // lowercased, minus honorifics/connectors
  hadHonorific: boolean
  totalCount: number
  strongCount: number // occurrences NOT at sentence start (proper-noun signal)
  firstPage: number
  perPage: Map<number, { count: number; surface: string }>
}

const WORD_RE = /[A-Za-z][A-Za-z'’.-]*/g

function isCapitalized(token: string): boolean {
  return /^[A-Z]/.test(token)
}

function honorificKey(token: string): string {
  return token.toLowerCase().replace(/\.$/, '')
}

function tokenKey(token: string): string {
  return token.toLowerCase().replace(/[.'’-]+$/g, '').replace(/^['’-]+/g, '')
}

// True when the gap text before a token implies a new sentence (so a leading
// capital is structural, not necessarily a name).
function startsSentence(gap: string, isFirst: boolean): boolean {
  if (isFirst) return true
  if (/[.!?]["'’)\]]*\s*$/.test(gap)) return true
  if (/\n\s*$/.test(gap)) return true
  return false
}

// Scan one page for proper-name runs (consecutive capitalized words, honorific
// anchors, internal connectors). Returns one entry per run occurrence.
interface RunOccurrence {
  surface: string
  significantTokens: string[]
  hadHonorific: boolean
  sentenceInitial: boolean
}

function scanRuns(text: string): RunOccurrence[] {
  const runs: RunOccurrence[] = []
  WORD_RE.lastIndex = 0
  let match: RegExpExecArray | null
  let prevEnd = 0
  let first = true

  let current: { tokens: string[]; significant: string[]; hadHonorific: boolean; sentenceInitial: boolean } | null =
    null

  const flush = (): void => {
    if (!current) return
    // Trim trailing connectors ("Joan of" with no following name).
    while (current.tokens.length > 0) {
      const last = current.tokens[current.tokens.length - 1]
      if (NAME_CONNECTORS.has(tokenKey(last))) current.tokens.pop()
      else break
    }
    if (current.tokens.length > 0 && current.significant.length > 0) {
      runs.push({
        surface: current.tokens.join(' '),
        significantTokens: current.significant,
        hadHonorific: current.hadHonorific,
        sentenceInitial: current.sentenceInitial
      })
    }
    current = null
  }

  while ((match = WORD_RE.exec(text)) !== null) {
    const token = match[0]
    const gap = text.slice(prevEnd, match.index)
    const contiguous = current !== null && /^[\s'’]*$/.test(gap)
    const sentenceInitial = startsSentence(gap, first)
    const cap = isCapitalized(token)
    const key = tokenKey(token)
    const isHonorific = HONORIFICS.has(honorificKey(token)) && cap
    const isConnector = NAME_CONNECTORS.has(key)

    if (cap && !isConnector) {
      if (current && contiguous) {
        current.tokens.push(token)
        if (isHonorific) current.hadHonorific = true
        else current.significant.push(key)
      } else {
        flush()
        current = {
          tokens: [token],
          significant: isHonorific ? [] : [key],
          hadHonorific: isHonorific,
          sentenceInitial
        }
      }
    } else if (isConnector && current && contiguous) {
      // Tentatively extend; trailing connectors are trimmed on flush.
      current.tokens.push(token)
    } else {
      flush()
    }

    prevEnd = match.index + token.length
    first = false
  }
  flush()
  return runs
}

/**
 * First pass: collect candidate proper-name surface forms across all pages with
 * frequency, "strong" (non-sentence-initial) counts, and per-page occurrences.
 */
export function extractCharacterCandidates(
  pages: Array<{ pageNumber: number; textContent: string | null }>
): RawCandidate[] {
  const byKey = new Map<string, RawCandidate>()

  for (const page of pages) {
    const text = page.textContent
    if (!text || !text.trim()) continue
    for (const run of scanRuns(text)) {
      // Drop runs that are entirely stopwords (e.g. "The", "And Then").
      const allStop = run.significantTokens.every((t) => TITLE_STOPWORDS.has(t))
      if (allStop) continue
      const key = run.significantTokens.join(' ')
      if (!key) continue
      let cand = byKey.get(key)
      if (!cand) {
        cand = {
          surfaceForm: run.surface,
          significantTokens: run.significantTokens,
          hadHonorific: run.hadHonorific,
          totalCount: 0,
          strongCount: 0,
          firstPage: page.pageNumber,
          perPage: new Map()
        }
        byKey.set(key, cand)
      }
      cand.totalCount += 1
      if (!run.sentenceInitial) cand.strongCount += 1
      if (run.hadHonorific) cand.hadHonorific = true
      cand.firstPage = Math.min(cand.firstPage, page.pageNumber)
      const pp = cand.perPage.get(page.pageNumber)
      if (pp) pp.count += 1
      else cand.perPage.set(page.pageNumber, { count: 1, surface: run.surface })
    }
  }

  // Keep only forms with a real proper-noun signal: seen mid-sentence at least
  // once, or honorific-anchored, or a multi-word name. This drops pure
  // sentence-openers ("Then", "However") that never appear mid-sentence.
  return [...byKey.values()].filter(
    (c) => c.strongCount > 0 || c.hadHonorific || c.significantTokens.length > 1
  )
}

interface ClusterNode {
  tokenSet: Set<string>
  forms: RawCandidate[]
  totalCount: number
}

function mergeForms(forms: RawCandidate[]): ExtractedEntity {
  const perPage = new Map<number, EntityMention>()
  let total = 0
  let firstPage = Number.POSITIVE_INFINITY
  for (const f of forms) {
    total += f.totalCount
    firstPage = Math.min(firstPage, f.firstPage)
    for (const [pageNumber, { count, surface }] of f.perPage) {
      const existing = perPage.get(pageNumber)
      if (existing) existing.count += count
      else perPage.set(pageNumber, { pageNumber, surfaceForm: surface, count })
    }
  }
  // Canonical name = highest-count form, tie-break by longer surface.
  const ranked = [...forms].sort(
    (a, b) => b.totalCount - a.totalCount || b.surfaceForm.length - a.surfaceForm.length
  )
  const name = ranked[0].surfaceForm
  const aliases = ranked
    .slice(1)
    .map((f) => f.surfaceForm)
    .filter((s) => s !== name)
  const mentions = [...perPage.values()].sort((a, b) => a.pageNumber - b.pageNumber)
  return {
    name,
    normalizedName: name.toLowerCase().replace(/\s+/g, ' ').trim(),
    aliases,
    mentionCount: total,
    firstPage: Number.isFinite(firstPage) ? firstPage : null,
    salience: 0, // filled by buildLocalEntityIndex once the max is known
    mentions
  }
}

/**
 * Second pass: merge surface forms that denote the same entity. Conservative —
 * (1) identical significant-token sets merge; (2) a single-token form folds into
 * a multi-token form only when EXACTLY ONE such superset exists (so "Bennet"
 * doesn't ambiguously merge two characters who share a surname).
 */
export function clusterAliases(candidates: RawCandidate[]): ExtractedEntity[] {
  // (1) group by exact token-set key.
  const bySet = new Map<string, ClusterNode>()
  for (const c of candidates) {
    const key = [...c.significantTokens].sort().join(' ')
    let node = bySet.get(key)
    if (!node) {
      node = { tokenSet: new Set(c.significantTokens), forms: [], totalCount: 0 }
      bySet.set(key, node)
    }
    node.forms.push(c)
    node.totalCount += c.totalCount
  }

  const nodes = [...bySet.values()]
  const multiToken = nodes.filter((n) => n.tokenSet.size > 1)
  const merged = new Set<ClusterNode>()

  // (2) fold single-token nodes into a unique multi-token superset.
  for (const node of nodes) {
    if (node.tokenSet.size !== 1) continue
    const [tok] = [...node.tokenSet]
    const supersets = multiToken.filter((m) => m.tokenSet.has(tok))
    if (supersets.length === 1) {
      supersets[0].forms.push(...node.forms)
      supersets[0].totalCount += node.totalCount
      merged.add(node)
    }
  }

  return nodes.filter((n) => !merged.has(n)).map((n) => mergeForms(n.forms))
}

export interface BuildEntityIndexOptions {
  minMentions?: number
  maxEntities?: number
}

/** Pure top-level entrypoint: pages → ranked, deduped character roster. */
export function buildLocalEntityIndex(
  pages: Array<{ pageNumber: number; textContent: string | null }>,
  opts: BuildEntityIndexOptions = {}
): ExtractedEntity[] {
  const minMentions = opts.minMentions ?? 2
  const maxEntities = opts.maxEntities ?? 40

  const candidates = extractCharacterCandidates(pages)
  const clustered = clusterAliases(candidates).filter((e) => e.mentionCount >= minMentions)
  if (clustered.length === 0) return []

  const maxCount = clustered.reduce((m, e) => Math.max(m, e.mentionCount), 1)
  for (const e of clustered) e.salience = e.mentionCount / maxCount

  return clustered.sort((a, b) => b.salience - a.salience).slice(0, maxEntities)
}

const FICTION_TAG_RE = /\b(said|asked|replied|whispered|shouted|murmured|cried|exclaimed)\b/gi
const ACADEMIC_RE = /\b(abstract|hypothesis|et al\.?|figure \d|references|bibliography|doi:|methodology)\b/gi

/**
 * Cheap gate: should we run character extraction on this document? True for
 * prose with dialogue signal and without strong academic markers. Keeps the
 * roster from filling non-fiction with garbage "characters".
 */
export function isLikelyFiction(extracted: ExtractedDocument): boolean {
  const sample = extracted.pages
    .slice(0, 12)
    .map((p) => p.textContent ?? '')
    .join('\n')
  if (sample.trim().length < 200) return false

  const quoteCount = (sample.match(/[“"]/g) ?? []).length
  const dialogueTags = (sample.match(FICTION_TAG_RE) ?? []).length
  const academic = (sample.match(ACADEMIC_RE) ?? []).length
  const words = Math.max(1, sample.split(/\s+/).length)

  const dialogueDensity = (quoteCount + dialogueTags * 3) / words // per word
  const academicDensity = academic / words

  // Strong academic signal vetoes; otherwise require some dialogue signal.
  if (academicDensity > 0.0015) return false
  return dialogueDensity > 0.002 || dialogueTags >= 2
}
