import { describe, it, expect } from 'vitest'
import { htmlToProjection } from '../src/main/services/extractors/htmlUtils'

// The projection is the canonical text_content. Its WORD sequence must match
// what a reader would tokenize from the rendered HTML, in order — this is the
// alignment the thesis index + reading aids rely on.
function words(s: string): string[] {
  return s.split(/\s+/).filter(Boolean)
}

describe('htmlToProjection', () => {
  it('preserves word order across block elements', () => {
    const html = '<h1>Chapter One</h1><p>The quick brown fox</p><p>jumped over.</p>'
    expect(words(htmlToProjection(html))).toEqual([
      'Chapter', 'One', 'The', 'quick', 'brown', 'fox', 'jumped', 'over.'
    ])
  })

  it('inserts paragraph breaks at block boundaries', () => {
    const out = htmlToProjection('<p>one</p><p>two</p>')
    expect(out).toBe('one\n\ntwo')
  })

  it('keeps inline emphasis text inline', () => {
    expect(htmlToProjection('<p>a <em>b</em> c</p>')).toBe('a b c')
  })

  it('decodes entities and strips all tags', () => {
    const out = htmlToProjection('<p>Tom &amp; Jerry &lt;3</p>')
    expect(out).toBe('Tom & Jerry <3')
    expect(out).not.toContain('&amp;')
  })

  it('turns list items and blockquotes into separate lines', () => {
    const out = htmlToProjection('<ul><li>first</li><li>second</li></ul>')
    expect(words(out)).toEqual(['first', 'second'])
  })

  it('handles <br> as a line break, not a word join', () => {
    expect(words(htmlToProjection('<p>line one<br>line two</p>'))).toEqual([
      'line', 'one', 'line', 'two'
    ])
  })
})
