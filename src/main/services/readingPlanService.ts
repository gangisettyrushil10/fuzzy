import type { PageRecord, ReadingPlan, ReadingPlanSection } from '@shared/types/database'

// Reading-speed assumptions. Tunable later — for v0.1 these are reasonable
// defaults for academic-leaning English text in a desktop reading session.
const WORDS_PER_MINUTE_DEEP = 200
const WORDS_PER_MINUTE_SKIM = 600
const MIN_DEEP_PAGES = 2 // never produce a plan that recommends 0 deep pages

// Adjacent pages with the same mode are merged into a single section so the
// renderer can show "deep-read 4–9" instead of six near-identical rows.
function compactSections(
  perPage: Array<{ pageNumber: number; mode: ReadingPlanSection['mode']; minutes: number }>
): ReadingPlanSection[] {
  const out: ReadingPlanSection[] = []
  for (const p of perPage) {
    const last = out[out.length - 1]
    if (last && last.mode === p.mode && last.pageEnd === p.pageNumber - 1) {
      last.pageEnd = p.pageNumber
      last.minutesAllocated += p.minutes
    } else {
      out.push({
        pageStart: p.pageNumber,
        pageEnd: p.pageNumber,
        mode: p.mode,
        minutesAllocated: p.minutes,
        reason: ''
      })
    }
  }
  // Fill in a human-ish reason for each compacted section.
  for (const s of out) {
    s.reason = sectionReason(s)
  }
  return out
}

function sectionReason(s: ReadingPlanSection): string {
  const span =
    s.pageStart === s.pageEnd ? `page ${s.pageStart}` : `pages ${s.pageStart}–${s.pageEnd}`
  switch (s.mode) {
    case 'deep_read':
      return `Deep-read ${span} — the densest material that pays off most for the time you have.`
    case 'skim':
      return `Skim ${span} — scan headings, first/last sentence of paragraphs, and figures.`
    case 'review':
      return `Save ${span} for a follow-up session — flag anything that comes up later.`
    case 'skip':
      return `Skip ${span} — out of scope for this session's time budget.`
  }
}

// Minutes a page would cost under each mode, given its word count.
function pageMinutes(words: number): { deep: number; skim: number } {
  const deep = words / WORDS_PER_MINUTE_DEEP
  const skim = words / WORDS_PER_MINUTE_SKIM
  // Floor every page at 0.25 min so a "page with 5 words" doesn't fall to 0
  // and let the planner over-allocate elsewhere.
  return { deep: Math.max(deep, 0.25), skim: Math.max(skim, 0.1) }
}

export interface GeneratePlanInput {
  documentId: string
  availableMinutes: number
  pages: PageRecord[]
}

// Pure function. Given page metrics and a time budget, return a tiered plan:
//   - If the user has enough time for every page → all deep_read.
//   - Else: keep the densest pages as deep_read, skim the rest in word-count
//     order until the budget is satisfied, mark anything left as review.
// The estimatedMinutes field is the total time the plan asks for, which can
// be less than availableMinutes if the document is short.
export function generateReadingPlan(input: GeneratePlanInput): ReadingPlan {
  const { documentId, availableMinutes, pages } = input
  if (pages.length === 0) {
    return {
      documentId,
      availableMinutes,
      estimatedMinutes: 0,
      strategy: 'deep_read',
      sections: [],
      keyConcepts: [],
      suggestedCheckpoints: []
    }
  }
  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber)
  const totals = sorted.map((p) => ({
    pageNumber: p.pageNumber,
    words: p.estimatedWordCount,
    ...pageMinutes(p.estimatedWordCount)
  }))
  const totalDeep = totals.reduce((s, p) => s + p.deep, 0)

  let strategy: ReadingPlan['strategy']
  let perPage: Array<{ pageNumber: number; mode: ReadingPlanSection['mode']; minutes: number }>

  if (totalDeep <= availableMinutes) {
    strategy = 'deep_read'
    perPage = totals.map((p) => ({
      pageNumber: p.pageNumber,
      mode: 'deep_read' as const,
      minutes: p.deep
    }))
  } else {
    // Greedy: rank pages by word count, deep-read the densest until budget
    // is filled, skim what remains. We always reserve a couple of pages for
    // deep reading so the user doesn't get "skim everything."
    const ranked = [...totals].sort((a, b) => b.words - a.words)
    const deepSet = new Set<number>()
    let budget = availableMinutes
    for (const p of ranked) {
      // Reserve enough budget that the rest can at least be skimmed.
      const remaining = ranked
        .filter((q) => q.pageNumber !== p.pageNumber && !deepSet.has(q.pageNumber))
        .reduce((s, q) => s + q.skim, 0)
      if (p.deep + remaining <= budget || deepSet.size < MIN_DEEP_PAGES) {
        deepSet.add(p.pageNumber)
        budget -= p.deep
        if (deepSet.size >= MIN_DEEP_PAGES && budget < ranked[0].skim) break
      }
    }

    // Anything not in deepSet gets skimmed if there's room, else marked review.
    const skimSet = new Set<number>()
    const reviewSet = new Set<number>()
    for (const p of totals) {
      if (deepSet.has(p.pageNumber)) continue
      if (budget - p.skim >= 0) {
        skimSet.add(p.pageNumber)
        budget -= p.skim
      } else {
        reviewSet.add(p.pageNumber)
      }
    }

    strategy = skimSet.size > deepSet.size ? 'skim_first' : 'balanced'
    perPage = totals.map((p) => {
      if (deepSet.has(p.pageNumber)) {
        return { pageNumber: p.pageNumber, mode: 'deep_read' as const, minutes: p.deep }
      }
      if (skimSet.has(p.pageNumber)) {
        return { pageNumber: p.pageNumber, mode: 'skim' as const, minutes: p.skim }
      }
      return { pageNumber: p.pageNumber, mode: 'review' as const, minutes: 0 }
    })
  }

  const sections = compactSections(perPage)
  const estimatedMinutes = round1(perPage.reduce((s, p) => s + p.minutes, 0))

  return {
    documentId,
    availableMinutes,
    estimatedMinutes,
    strategy,
    sections,
    keyConcepts: [],
    suggestedCheckpoints: []
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
