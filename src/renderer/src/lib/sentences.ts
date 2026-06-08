import { tokenize, words } from './tokenize'
import { analyzeComplexity, type ComplexitySensitivity } from './complexity'

// Finds the single hardest sentence on a page for ambient auto-explain. Pure +
// DOM-free (unit-tested). "Hardest" = high complex-word density, weighted toward
// longer sentences; very short sentences are skipped. Returns null when nothing
// is genuinely hard, so we don't explain easy text.

export interface HardestSentence {
  sentence: string
  score: number
  index: number
}

const MIN_WORDS = 12
const SCORE_THRESHOLD = 0.12

export function splitSentences(text: string): string[] {
  const norm = text.replace(/\s+/g, ' ').trim()
  if (!norm) return []
  return (norm.match(/[^.!?]+[.!?]+(?:["')\]]+)?|\S[^.!?]*$/g) ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
}

export function hardestSentence(
  text: string,
  isCommon: (word: string) => boolean,
  sensitivity: ComplexitySensitivity = 'subtle'
): HardestSentence | null {
  const effective = sensitivity === 'off' ? 'subtle' : sensitivity
  const sentences = splitSentences(text)
  let best: HardestSentence | null = null
  let bestScore = -Infinity
  for (let index = 0; index < sentences.length; index++) {
    const sentence = sentences[index]
    const tokens = tokenize(sentence)
    const wordCount = words(tokens).length
    if (wordCount < MIN_WORDS) continue
    const complex = analyzeComplexity(tokens, effective, isCommon).complexIndices.size
    const density = complex / wordCount
    const lengthFactor = Math.min(1, wordCount / 40)
    const score = density * 0.8 + lengthFactor * 0.2
    if (score > bestScore) {
      bestScore = score
      best = { sentence, score, index }
    }
  }
  return best && bestScore >= SCORE_THRESHOLD ? best : null
}
