import { describe, it, expect } from 'vitest'
import { sanitizeReaderHtml, toRichSection } from '../src/main/services/extractors/htmlUtils'

describe('sanitizeReaderHtml', () => {
  it('strips scripts, styles, and their content', () => {
    const out = sanitizeReaderHtml('<p>Hi</p><script>alert(1)</script><style>p{}</style>')
    expect(out).toContain('<p>Hi</p>')
    expect(out).not.toContain('alert')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('<style')
  })

  it('drops event handlers and javascript: hrefs', () => {
    const out = sanitizeReaderHtml('<a href="javascript:evil()" onclick="x()">link</a>')
    expect(out).toContain('link')
    expect(out).not.toContain('javascript:')
    expect(out).not.toContain('onclick')
  })

  it('keeps safe http/mailto links', () => {
    const out = sanitizeReaderHtml('<a href="https://example.com">x</a><a href="mailto:a@b.c">y</a>')
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('href="mailto:a@b.c"')
  })

  it('allows data: image src but drops remote img src', () => {
    const dataImg = '<img src="data:image/png;base64,AAAA" alt="ok">'
    expect(sanitizeReaderHtml(dataImg)).toContain('data:image/png;base64,AAAA')
    const remote = sanitizeReaderHtml('<img src="https://evil.test/x.png" alt="bad">')
    expect(remote).not.toContain('https://evil.test')
  })

  it('drops iframe/object/embed entirely', () => {
    const out = sanitizeReaderHtml('<p>a</p><iframe src="x"></iframe><object></object><embed>')
    expect(out).toContain('<p>a</p>')
    expect(out).not.toContain('<iframe')
    expect(out).not.toContain('<object')
    expect(out).not.toContain('<embed')
  })

  it('keeps structural + inline book tags', () => {
    const html = '<h1>T</h1><p><em>a</em> <strong>b</strong></p><blockquote>q</blockquote><ul><li>i</li></ul>'
    const out = sanitizeReaderHtml(html)
    for (const tag of ['<h1>', '<p>', '<em>', '<strong>', '<blockquote>', '<ul>', '<li>']) {
      expect(out).toContain(tag)
    }
  })

  it('strips class/style attributes (theming is owned by .prose-fz)', () => {
    const out = sanitizeReaderHtml('<p class="x" style="color:red">a</p>')
    expect(out).toContain('<p>a</p>')
    expect(out).not.toContain('class')
    expect(out).not.toContain('style')
  })
})

describe('toRichSection', () => {
  it('returns sanitized html paired with a plain projection', () => {
    const s = toRichSection('<h1>Title</h1><p>Hello <em>world</em>.</p>')
    expect(s).not.toBeNull()
    expect(s!.html).toContain('<h1>Title</h1>')
    expect(s!.text).toContain('Title')
    expect(s!.text).toContain('Hello world.')
    expect(s!.text).not.toContain('<')
  })

  it('returns null for content with no readable text', () => {
    expect(toRichSection('<hr><img src="data:image/png;base64,AA">')).toBeNull()
    expect(toRichSection('   ')).toBeNull()
  })
})
