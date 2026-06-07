import { describe, it, expect } from 'vitest'
import { revealedChars, revealedText, isRevealComplete } from './reveal'

describe('reveal', () => {
  it('reveals nothing at t=0 and grows with time', () => {
    expect(revealedChars(0, 60)).toBe(0)
    expect(revealedChars(1000, 60)).toBe(60)
    expect(revealedChars(500, 60)).toBe(30)
  })

  it('cps <= 0 means instant (everything visible)', () => {
    expect(revealedChars(0, 0)).toBe(Number.MAX_SAFE_INTEGER)
    expect(revealedText('hello', 0, 0)).toBe('hello')
  })

  it('revealedText returns a growing prefix, capped at full length', () => {
    const s = 'hello world'
    expect(revealedText(s, 0, 60)).toBe('')
    // 60 cps -> 6 chars at 100ms
    expect(revealedText(s, 100, 60)).toBe('hello ')
    expect(revealedText(s, 100000, 60)).toBe(s)
  })

  it('isRevealComplete flips once enough time passes', () => {
    expect(isRevealComplete(50, 60, 11)).toBe(false)
    expect(isRevealComplete(1000, 60, 11)).toBe(true)
  })
})
