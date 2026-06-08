// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { WordLayer, wrapWords } from '../src/renderer/src/lib/domWordWrap'
import { tokenize, words, findWordSequence } from '../src/renderer/src/lib/tokenize'

function div(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

describe('wrapWords', () => {
  it('wraps every word in a data-token-index span across block elements', () => {
    const el = div('<h1>Chapter One</h1><p>The quick fox.</p>')
    const spans = new Map<number, HTMLElement[]>()
    wrapWords(el, spans)
    const wrapped = Array.from(el.querySelectorAll('[data-token-index]')).map((s) => s.textContent)
    expect(wrapped).toEqual(['Chapter', 'One', 'The', 'quick', 'fox'])
  })

  it('preserves the container text content (selection fidelity)', () => {
    const el = div('<p>The quick <em>brown</em> fox.</p>')
    const before = el.textContent
    wrapWords(el, new Map())
    expect(el.textContent).toBe(before)
  })

  it('assigns data-token-index equal to the full tokenize() index of the source', () => {
    const el = div('<p>one two</p><p>three</p>')
    const spans = new Map<number, HTMLElement[]>()
    const source = wrapWords(el, spans)
    const wordTokens = words(tokenize(source))
    // Each wrapped span's index must be a real word-token index in the source.
    for (const t of wordTokens) {
      const span = el.querySelector(`[data-token-index="${t.index}"]`)
      expect(span?.textContent).toBe(t.text)
    }
    expect(spans.size).toBe(wordTokens.length)
  })

  it('skips <pre> and <code> blocks', () => {
    const el = div('<p>hello</p><pre>raw code here</pre><p>world</p>')
    wrapWords(el, new Map())
    const wrapped = Array.from(el.querySelectorAll('[data-token-index]')).map((s) => s.textContent)
    expect(wrapped).toEqual(['hello', 'world'])
    // The pre text is untouched (no spans inside it).
    expect(el.querySelector('pre')?.querySelector('[data-token-index]')).toBeNull()
    expect(el.querySelector('pre')?.textContent).toBe('raw code here')
  })
})

describe('WordLayer', () => {
  it('flash() and findWordSequence resolve a snippet to the right spans', () => {
    const layer = new WordLayer(div('<p>The quick brown fox jumps over the lazy dog.</p>'))
    const indices = findWordSequence(layer.source, 'brown fox jumps')
    expect(indices.length).toBe(3)
    // No throw, and the indices map to real spans on the layer.
    expect(() => layer.flash(indices)).not.toThrow()
  })

  it('setActive toggles the pacer class on the right span', () => {
    const el = div('<p>alpha beta gamma</p>')
    const layer = new WordLayer(el)
    const beta = words(tokenize(layer.source)).find((t) => t.text === 'beta')!
    layer.setActive(beta.index)
    expect(el.querySelector(`[data-token-index="${beta.index}"]`)?.classList.contains('fz-pace-active')).toBe(true)
    layer.setActive(null)
    expect(el.querySelector(`[data-token-index="${beta.index}"]`)?.classList.contains('fz-pace-active')).toBe(false)
  })

  it('setFlagged underlines flagged words and clears stale ones', () => {
    const el = div('<p>alpha beta gamma</p>')
    const layer = new WordLayer(el)
    const toks = words(tokenize(layer.source))
    const alpha = toks.find((t) => t.text === 'alpha')!
    const gamma = toks.find((t) => t.text === 'gamma')!
    layer.setFlagged(new Set([alpha.index]), () => {})
    expect(el.querySelector(`[data-token-index="${alpha.index}"]`)?.classList.contains('fz-complex-word')).toBe(true)
    // Re-flag a different word — the old one must be cleared.
    layer.setFlagged(new Set([gamma.index]), () => {})
    expect(el.querySelector(`[data-token-index="${alpha.index}"]`)?.classList.contains('fz-complex-word')).toBe(false)
    expect(el.querySelector(`[data-token-index="${gamma.index}"]`)?.classList.contains('fz-complex-word')).toBe(true)
  })
})
