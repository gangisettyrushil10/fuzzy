import { describe, it, expect } from 'vitest'
import { detectAskIntent, extractiveSummary } from '../src/main/services/ask/askIntent'

describe('detectAskIntent', () => {
  it('treats plain questions as Q&A', () => {
    expect(detectAskIntent('What is a patronus?')).toEqual({ mode: 'qa', page: null })
    expect(detectAskIntent('Who does Sirius live with?')).toEqual({ mode: 'qa', page: null })
  })

  it('detects "summarize this chapter" with no explicit page', () => {
    expect(detectAskIntent('summarize this chapter')).toEqual({ mode: 'summary', page: null })
    expect(detectAskIntent('Can you recap the current chapter?')).toEqual({ mode: 'summary', page: null })
    expect(detectAskIntent('tl;dr')).toEqual({ mode: 'summary', page: null })
    expect(detectAskIntent('what happens in this part')).toEqual({ mode: 'summary', page: null })
  })

  it('extracts an explicit chapter/page number', () => {
    expect(detectAskIntent('summarize chapter 12')).toEqual({ mode: 'summary', page: 12 })
    expect(detectAskIntent('give me a summary of ch 3')).toEqual({ mode: 'summary', page: 3 })
    expect(detectAskIntent('recap page 45 please')).toEqual({ mode: 'summary', page: 45 })
  })

  it('does not treat a question that merely mentions a chapter as a summary', () => {
    expect(detectAskIntent('what happens to Remus in chapter 5')).toEqual({ mode: 'summary', page: 5 })
    expect(detectAskIntent('is chapter 5 about the war')).toEqual({ mode: 'qa', page: null })
  })
})

describe('extractiveSummary', () => {
  it('returns the whole thing when short', () => {
    expect(extractiveSummary('One sentence. Two sentences.')).toBe('One sentence. Two sentences.')
  })

  it('keeps lead sentences plus the closing one when long', () => {
    const text = 'A. B. C. D. E. F.'
    const out = extractiveSummary(text, 4)
    expect(out).toBe('A. B. C. F.')
  })

  it('falls back to a slice when there is no sentence punctuation', () => {
    expect(extractiveSummary('no punctuation here just words')).toBe('no punctuation here just words')
  })
})
