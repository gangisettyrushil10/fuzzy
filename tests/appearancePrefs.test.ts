import { describe, it, expect } from 'vitest'
import {
  DEFAULT_APPEARANCE_PREFS,
  isHexColor,
  normalizeAppearancePrefs
} from '@shared/types/database'

describe('normalizeAppearancePrefs', () => {
  it('returns defaults for junk input', () => {
    expect(normalizeAppearancePrefs(null)).toEqual(DEFAULT_APPEARANCE_PREFS)
    expect(normalizeAppearancePrefs('nope')).toEqual(DEFAULT_APPEARANCE_PREFS)
    expect(normalizeAppearancePrefs(42)).toEqual(DEFAULT_APPEARANCE_PREFS)
  })

  it('falls back on unknown ids but keeps valid ones', () => {
    const p = normalizeAppearancePrefs({ themeId: 'neon-disco', accentId: 'teal' })
    expect(p.themeId).toBe(DEFAULT_APPEARANCE_PREFS.themeId)
    expect(p.accentId).toBe('teal')
  })

  it('accepts the special auto theme and theme accent', () => {
    const p = normalizeAppearancePrefs({ themeId: 'auto', accentId: 'theme' })
    expect(p.themeId).toBe('auto')
    expect(p.accentId).toBe('theme')
  })

  it('normalizes a valid custom hex to lowercase and rejects bad ones', () => {
    expect(normalizeAppearancePrefs({ customAccent: '#AABBCC' }).customAccent).toBe('#aabbcc')
    expect(normalizeAppearancePrefs({ customAccent: 'red' }).customAccent).toBeNull()
    expect(normalizeAppearancePrefs({ customAccent: '#abc' }).customAccent).toBeNull()
    expect(normalizeAppearancePrefs({ customAccent: 123 }).customAccent).toBeNull()
  })

  it('merges as a patch over defaults', () => {
    const p = normalizeAppearancePrefs({ ...DEFAULT_APPEARANCE_PREFS, themeId: 'paper' })
    expect(p.themeId).toBe('paper')
    expect(p.accentId).toBe(DEFAULT_APPEARANCE_PREFS.accentId)
  })
})

describe('isHexColor', () => {
  it('accepts 6-digit hex only', () => {
    expect(isHexColor('#7c5cff')).toBe(true)
    expect(isHexColor('#FFFFFF')).toBe(true)
    expect(isHexColor('#fff')).toBe(false)
    expect(isHexColor('7c5cff')).toBe(false)
    expect(isHexColor(null)).toBe(false)
  })
})
