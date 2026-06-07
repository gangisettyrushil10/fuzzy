import { describe, it, expect } from 'vitest'
import { DEFAULT_READER_PREFS, normalizeReaderPrefs } from '@shared/types/database'

describe('normalizeReaderPrefs', () => {
  it('returns defaults for junk input', () => {
    expect(normalizeReaderPrefs(null)).toEqual(DEFAULT_READER_PREFS)
    expect(normalizeReaderPrefs('nope')).toEqual(DEFAULT_READER_PREFS)
    expect(normalizeReaderPrefs(42)).toEqual(DEFAULT_READER_PREFS)
  })

  it('clamps numeric fields into range', () => {
    const p = normalizeReaderPrefs({ fontSize: 999, lineHeight: 0.1, targetWpm: 5 })
    expect(p.fontSize).toBe(32)
    expect(p.lineHeight).toBe(1.3)
    expect(p.targetWpm).toBe(100)
  })

  it('rounds wpm and keeps valid values', () => {
    const p = normalizeReaderPrefs({ targetWpm: 333.7, fontSize: 18 })
    expect(p.targetWpm).toBe(334)
    expect(p.fontSize).toBe(18)
  })

  it('falls back on invalid enums but keeps valid ones', () => {
    const p = normalizeReaderPrefs({ contentWidth: 'huge', citationFormat: 'apa' })
    expect(p.contentWidth).toBe('normal')
    expect(p.citationFormat).toBe('apa')
  })

  it('preserves booleans and merges as a patch over defaults', () => {
    const p = normalizeReaderPrefs({ ...DEFAULT_READER_PREFS, focusMode: true, animations: false })
    expect(p.focusMode).toBe(true)
    expect(p.animations).toBe(false)
    expect(p.complexitySensitivity).toBe('subtle')
  })

  it('validates typography enums, falling back on junk', () => {
    const p = normalizeReaderPrefs({ fontFamily: 'comic-sans', textAlign: 'center', readingTheme: 'neon' })
    expect(p.fontFamily).toBe(DEFAULT_READER_PREFS.fontFamily)
    expect(p.textAlign).toBe('left')
    expect(p.readingTheme).toBe('match-app')
    const ok = normalizeReaderPrefs({ fontFamily: 'dyslexic', textAlign: 'justify', readingTheme: 'sepia' })
    expect(ok.fontFamily).toBe('dyslexic')
    expect(ok.textAlign).toBe('justify')
    expect(ok.readingTheme).toBe('sepia')
  })

  it('clamps spacing and normalizes custom page hex', () => {
    const p = normalizeReaderPrefs({
      paragraphSpacing: 99,
      letterSpacing: -5,
      customPageBg: '#AABBCC',
      customPageFg: 'not-a-color'
    })
    expect(p.paragraphSpacing).toBe(2)
    expect(p.letterSpacing).toBe(-0.05)
    expect(p.customPageBg).toBe('#aabbcc')
    expect(p.customPageFg).toBeNull()
  })
})
