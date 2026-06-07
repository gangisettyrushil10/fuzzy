import { describe, it, expect } from 'vitest'
import {
  formatAllCitations,
  formatCitation,
  type CitationSource
} from '../src/main/services/thesis/citationFormatter'

const full: CitationSource = {
  title: 'The Origin of Species',
  author: 'Charles Darwin',
  year: 1859,
  publisher: 'John Murray'
}

describe('citationFormatter', () => {
  it('formats all four styles for a complete source', () => {
    const all = formatAllCitations(full, 42)
    expect(all.mla).toContain('Darwin, Charles')
    expect(all.mla).toContain('"The Origin of Species."')
    expect(all.mla).toContain('p. 42')
    expect(all.apa).toContain('(1859)')
    expect(all.apa).toContain('Darwin, C.')
    expect(all.chicago).toContain('Charles Darwin')
    expect(all.chicago).toContain('(John Murray, 1859), 42')
    expect(all.harvard).toContain('Darwin, C. 1859')
    expect(all.harvard).toContain('p. 42')
  })

  it('uses n.d. for a missing year', () => {
    const src: CitationSource = { ...full, year: null }
    expect(formatCitation('mla', src, 5)).toContain('n.d.')
    expect(formatCitation('apa', src, 5)).toContain('n.d.')
  })

  it('falls back to title-led when there is no author', () => {
    const src: CitationSource = { title: 'Anon Report', author: null, year: 2020, publisher: null }
    const apa = formatCitation('apa', src, 3)
    expect(apa).toContain('Anon Report')
    expect(apa).toContain('(2020)')
  })

  it('parses "Last, First" author form', () => {
    const src: CitationSource = { ...full, author: 'Woolf, Virginia' }
    expect(formatCitation('mla', src, 1)).toContain('Woolf, Virginia')
    expect(formatCitation('harvard', src, 1)).toContain('Woolf, V.')
  })

  it('omits publisher cleanly when absent', () => {
    const src: CitationSource = { ...full, publisher: null }
    const mla = formatCitation('mla', src, 9)
    expect(mla).not.toContain('undefined')
    expect(mla).toContain('1859, p. 9')
  })
})
