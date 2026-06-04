import { describe, expect, it } from 'vitest'
import { __test } from '../src/main/services/pdfTextExtractor'

const { flattenTextContent } = __test

describe('flattenTextContent', () => {
  it('joins glyph items with single spaces', () => {
    const items = [{ str: 'hello' }, { str: 'world' }]
    expect(flattenTextContent(items)).toBe('hello world')
  })

  it('honours hasEOL by inserting a newline after the item', () => {
    const items = [{ str: 'first line', hasEOL: true }, { str: 'second' }]
    expect(flattenTextContent(items)).toBe('first line\nsecond')
  })

  it('collapses runs of whitespace inside a line', () => {
    const items = [{ str: 'a   b   c' }]
    expect(flattenTextContent(items)).toBe('a b c')
  })

  it('drops items without a str property', () => {
    const items = [{ str: 'keep' }, { weird: true }, null, undefined, { str: 'me' }]
    expect(flattenTextContent(items as unknown[])).toBe('keep me')
  })

  it('trims leading and trailing whitespace', () => {
    const items = [{ str: '   padded   ' }]
    expect(flattenTextContent(items)).toBe('padded')
  })
})
