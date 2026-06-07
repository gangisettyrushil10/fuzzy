// Auto-sensing of "complex" words for the reading aid. Pure + sync so it can
// run on the fly per page (memoized by the store) and unit-test cleanly. The
// common-word lookup is injected (see frequencyList.ts) so this module never
// has to load the bundled asset to be tested.

import type { Token } from './tokenize'
import type { ComplexitySensitivity } from '@shared/types/database'

export type { ComplexitySensitivity }

export interface ComplexityThresholds {
  minSyllables: number
  minLength: number
}

// subtle = only genuinely uncommon/long words; aggressive = lower bars (good
// for ESL / struggling readers). Tuned in the plan.
export const SENSITIVITY_THRESHOLDS: Record<
  Exclude<ComplexitySensitivity, 'off'>,
  ComplexityThresholds
> = {
  subtle: { minSyllables: 4, minLength: 13 },
  aggressive: { minSyllables: 3, minLength: 10 }
}

export interface ComplexityResult {
  // token.index values that were flagged complex.
  complexIndices: Set<number>
  // token.index -> 0..1 difficulty score (for future intensity styling).
  scoreByIndex: Map<number, number>
  // Rough share of words flagged on the page (0..1).
  pageScore: number
}

// English syllable estimate. Heuristic but stable: count vowel groups, drop a
// common silent trailing 'e'/'es'/'ed', floor at 1.
export function estimateSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (w.length === 0) return 0
  if (w.length <= 3) return 1
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  const groups = trimmed.match(/[aeiouy]{1,2}/g)
  return groups ? Math.max(1, groups.length) : 1
}

function isFlaggableShape(raw: string): boolean {
  if (raw.length < 4) return false
  if (/\d/.test(raw)) return false // numbers / alphanumerics
  // ALL-CAPS run of 2+ is almost always an acronym, not a hard word.
  if (raw.length >= 2 && raw === raw.toUpperCase() && /[A-Z]/.test(raw)) return false
  return true
}

const SENTENCE_BOUNDARY = /[.!?]|\n/

// Flag a word as complex when it is not in the common list AND clears either
// the length or the syllable bar for the chosen sensitivity. Proper nouns are
// skipped via a light heuristic: a Capitalized word that is NOT at the start of
// a sentence is treated as a name/place and left alone.
export function analyzeComplexity(
  tokens: Token[],
  sensitivity: ComplexitySensitivity,
  isCommon: (word: string) => boolean
): ComplexityResult {
  const complexIndices = new Set<number>()
  const scoreByIndex = new Map<number, number>()
  if (sensitivity === 'off') return { complexIndices, scoreByIndex, pageScore: 0 }

  const { minSyllables, minLength } = SENSITIVITY_THRESHOLDS[sensitivity]
  let wordCount = 0
  let atSentenceStart = true

  for (const t of tokens) {
    if (!t.isWord) {
      if (SENTENCE_BOUNDARY.test(t.text)) atSentenceStart = true
      continue
    }
    wordCount++
    const startsUpper = t.text !== t.text.toLowerCase()
    const isProperNoun = startsUpper && /^[A-ZÀ-Þ]/.test(t.text) && !atSentenceStart
    atSentenceStart = false

    if (isProperNoun) continue
    if (!isFlaggableShape(t.text)) continue

    const lower = t.text.toLowerCase().replace(/['’]s$/, '')
    if (isCommon(lower)) continue

    const syllables = estimateSyllables(lower)
    const longEnough = lower.length >= minLength
    const syllabicEnough = syllables >= minSyllables
    if (!longEnough && !syllabicEnough) continue

    const lenScore = Math.min(1, lower.length / (minLength + 4))
    const syllScore = Math.min(1, syllables / (minSyllables + 2))
    complexIndices.add(t.index)
    scoreByIndex.set(t.index, Math.max(lenScore, syllScore))
  }

  return {
    complexIndices,
    scoreByIndex,
    pageScore: wordCount > 0 ? complexIndices.size / wordCount : 0
  }
}
