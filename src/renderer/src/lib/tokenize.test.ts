import { describe, it, expect } from 'vitest'
import { tokenize, words, weightForToken, findWordSequence } from './tokenize'

describe('tokenize', () => {
  it('round-trips: concatenating token text reproduces the source', () => {
    const text = "The  quick brown\nfox, don't well-being.\n\nNext."
    const toks = tokenize(text)
    expect(toks.map((t) => t.text).join('')).toBe(text)
  })

  it('offsets point back at the exact substring', () => {
    const text = 'alpha beta gamma'
    for (const t of tokenize(text)) {
      expect(text.slice(t.start, t.end)).toBe(t.text)
    }
  })

  it('keeps internal apostrophes and hyphens inside one word', () => {
    const w = words(tokenize("don't well-being it's"))
    expect(w.map((t) => t.text)).toEqual(["don't", 'well-being', "it's"])
  })

  it('separates words from punctuation/whitespace gaps', () => {
    const toks = tokenize('Hi, there!')
    expect(toks.filter((t) => t.isWord).map((t) => t.text)).toEqual(['Hi', 'there'])
    expect(toks.some((t) => !t.isWord && t.text.includes(','))).toBe(true)
  })

  it('assigns line indices across newlines', () => {
    const w = words(tokenize('one two\nthree\n\nfour'))
    expect(w.find((t) => t.text === 'one')!.lineIndex).toBe(0)
    expect(w.find((t) => t.text === 'three')!.lineIndex).toBe(1)
    expect(w.find((t) => t.text === 'four')!.lineIndex).toBe(3)
  })

  it('token indices are contiguous and ordered', () => {
    const toks = tokenize('a b c')
    expect(toks.map((t) => t.index)).toEqual([...toks.keys()])
  })

  it('weights longer words more, clamps, and ignores gaps', () => {
    const toks = tokenize('a internationalization ,')
    const a = toks.find((t) => t.text === 'a')!
    const big = toks.find((t) => t.text === 'internationalization')!
    const gap = toks.find((t) => !t.isWord)!
    expect(weightForToken(a)).toBeLessThan(weightForToken(big))
    expect(weightForToken(big)).toBeLessThanOrEqual(3)
    expect(weightForToken(a)).toBeGreaterThanOrEqual(0.5)
    expect(weightForToken(gap)).toBe(0)
  })

  it('handles empty and whitespace-only input', () => {
    expect(tokenize('')).toEqual([])
    expect(words(tokenize('   \n  ')).length).toBe(0)
  })
})

describe('findWordSequence', () => {
  const hay = 'Climate change is accelerating.\nSea levels rise across the globe.'

  it('finds a contiguous quote and returns its word token indices', () => {
    const toks = tokenize(hay)
    const indices = findWordSequence(hay, 'sea levels rise across')
    const matchedWords = indices.map((i) => toks[i].text)
    expect(matchedWords).toEqual(['Sea', 'levels', 'rise', 'across'])
  })

  it('is whitespace/newline insensitive', () => {
    expect(findWordSequence(hay, 'change   is\naccelerating').length).toBe(3)
  })

  it('returns [] when not present', () => {
    expect(findWordSequence(hay, 'mitochondria powerhouse')).toEqual([])
  })

  it('stops at the first non-matching word in an over-long query', () => {
    const indices = findWordSequence(hay, 'across the globe entirely and forever')
    // matches "across the globe", then stops.
    expect(indices.length).toBe(3)
  })
})
