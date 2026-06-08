import { describe, it, expect } from 'vitest'
import { splitSentences, hardestSentence } from './sentences'

const COMMON = new Set([
  'the', 'a', 'an', 'and', 'is', 'are', 'was', 'cat', 'sat', 'on', 'mat', 'dog', 'ran', 'fast',
  'it', 'to', 'of', 'in', 'he', 'she', 'they', 'we', 'this', 'that', 'very', 'good', 'day', 'so'
])
const isCommon = (w: string): boolean => COMMON.has(w)

describe('splitSentences', () => {
  it('splits on terminal punctuation', () => {
    expect(splitSentences('One. Two! Three?')).toEqual(['One.', 'Two!', 'Three?'])
  })
  it('handles trailing fragment + whitespace', () => {
    expect(splitSentences('  A sentence. A fragment ')).toEqual(['A sentence.', 'A fragment'])
  })
})

describe('hardestSentence', () => {
  it('picks the dense, long, jargon-heavy sentence over simple ones', () => {
    const text =
      'The cat sat on the mat. ' +
      'The phenomenological hermeneutics of poststructural epistemology problematizes the ontological presuppositions underlying conventional interpretive paradigms entirely.'
    const r = hardestSentence(text, isCommon)
    expect(r).not.toBeNull()
    expect(r!.sentence).toContain('phenomenological')
  })

  it('returns null when nothing is hard', () => {
    const text = 'The cat sat on the mat. The dog ran very fast. It was a good day.'
    expect(hardestSentence(text, isCommon)).toBeNull()
  })

  it('skips very short sentences even if dense', () => {
    // "Ineffable!" is one hard word but too short to flag.
    expect(hardestSentence('Ineffable!', isCommon)).toBeNull()
  })
})
