import { describe, expect, it } from 'vitest'
import { isAllowedExternalScheme } from '../src/main/services/urlSafety'

// Guards setWindowOpenHandler + will-navigate in src/main/index.ts. Anything
// the OS would resolve to a non-web/email scheme MUST come back false so we
// never hand it to shell.openExternal.

describe('isAllowedExternalScheme', () => {
  it('accepts a regular https URL', () => {
    expect(isAllowedExternalScheme('https://example.com/foo')).toBe(true)
  })

  it('accepts a plain http URL', () => {
    expect(isAllowedExternalScheme('http://example.com')).toBe(true)
  })

  it('accepts a mailto: link', () => {
    expect(isAllowedExternalScheme('mailto:hello@example.com')).toBe(true)
  })

  it('rejects file:// URLs', () => {
    expect(isAllowedExternalScheme('file:///etc/passwd')).toBe(false)
  })

  it('rejects javascript: URLs', () => {
    expect(isAllowedExternalScheme('javascript:alert(1)')).toBe(false)
  })

  it('rejects malformed URLs (parse failure)', () => {
    expect(isAllowedExternalScheme('not-a-url')).toBe(false)
    expect(isAllowedExternalScheme('')).toBe(false)
  })

  it('rejects exotic app-protocol schemes', () => {
    expect(isAllowedExternalScheme('vscode://file/etc/passwd')).toBe(false)
    expect(isAllowedExternalScheme('slack://channel/123')).toBe(false)
  })
})
