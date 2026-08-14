// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { stripLeadingHeadingNoise, visibleTextFromViewport } from '../src/renderer/src/lib/visibleText'

function rect(top: number, bottom: number): DOMRect {
  return {
    top,
    bottom,
    left: 0,
    right: 200,
    width: 200,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({})
  } as DOMRect
}

describe('visibleTextFromViewport', () => {
  it('keeps only text ranges that intersect the viewport', () => {
    document.body.innerHTML = '<main id="root">above visible words below</main><div id="viewport"></div>'
    const root = document.getElementById('root') as HTMLElement
    const viewport = document.getElementById('viewport') as HTMLElement
    const visibleStarts = new Set<number>([6, 14])

    const text = visibleTextFromViewport(root, viewport, {
      viewportRect: rect(100, 200),
      getRangeRects: (_range, _node, start) => [visibleStarts.has(start) ? rect(120, 136) : rect(20, 36)]
    })

    expect(text).toBe('visible words')
  })

  it('skips hidden text and script/style content', () => {
    document.body.innerHTML = `
      <main id="root">
        <span aria-hidden="true">hidden</span>
        <script>script words</script>
        <span>visible prose</span>
      </main>
      <div id="viewport"></div>
    `
    const root = document.getElementById('root') as HTMLElement
    const viewport = document.getElementById('viewport') as HTMLElement

    const text = visibleTextFromViewport(root, viewport, {
      viewportRect: rect(100, 200),
      getRangeRects: () => [rect(120, 136)]
    })

    expect(text).toBe('visible prose')
  })
})

describe('stripLeadingHeadingNoise', () => {
  it('drops a tiny heading sentence when enough body prose follows', () => {
    const body = Array.from({ length: 36 }, (_, i) => `word${i}`).join(' ')
    expect(stripLeadingHeadingNoise(`Opening credits. ${body}`)).toBe(body)
  })

  it('keeps short dialogue as scene text', () => {
    const body = Array.from({ length: 36 }, (_, i) => `word${i}`).join(' ')
    expect(stripLeadingHeadingNoise(`"Ready?" ${body}`)).toBe(`"Ready?" ${body}`)
  })
})
