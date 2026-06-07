import { describe, it, expect } from 'vitest'
import { buildProjectMarkdown, buildProjectHtml } from '../src/main/services/export/exportService'
import type { ProjectDetail, CitationFormat } from '../src/shared/types/database'

const cites = (s: string): Record<CitationFormat, string> => ({
  mla: `${s} (MLA), p. 5.`,
  apa: `${s} (APA), p. 5.`,
  chicago: `${s} (Chicago), 5.`,
  harvard: `${s} (Harvard), p. 5.`
})

const detail: ProjectDetail = {
  project: {
    id: 'p1',
    title: 'Climate Essay',
    thesis: 'Warming is accelerating.',
    createdAt: 't',
    updatedAt: 't'
  },
  evidence: [
    {
      id: 'e1',
      projectId: 'p1',
      documentId: 'd1',
      documentTitle: 'Origin',
      pageNumber: 5,
      snippet: 'Ice is melting fast.',
      citations: cites('Darwin'),
      score: 0.9,
      createdAt: 't'
    },
    {
      id: 'e2',
      projectId: 'p1',
      documentId: 'd1',
      documentTitle: 'Origin',
      pageNumber: 7,
      snippet: 'Seas are rising.',
      citations: cites('Darwin'),
      score: 0.8,
      createdAt: 't'
    }
  ],
  notes: [{ id: 'n1', projectId: 'p1', content: 'Remember to compare regions.', createdAt: 't', updatedAt: 't' }],
  syntheses: []
}

describe('exportService', () => {
  it('renders title, thesis, grouped evidence, notes, and a deduped bibliography', () => {
    const md = buildProjectMarkdown(detail, 'mla')
    expect(md).toContain('# Climate Essay')
    expect(md).toContain('**Thesis:** Warming is accelerating.')
    expect(md).toContain('### Origin')
    expect(md).toContain('Ice is melting fast.')
    expect(md).toContain('## Notes')
    expect(md).toContain('Remember to compare regions.')
    // Bibliography dedupes the two same-source entries and strips the page.
    const bib = md.slice(md.indexOf('## Bibliography'))
    expect(bib.match(/Darwin \(MLA\)/g)?.length).toBe(1)
    expect(bib).not.toContain('p. 5')
  })

  it('respects the chosen citation format', () => {
    expect(buildProjectMarkdown(detail, 'apa')).toContain('Darwin (APA)')
  })

  it('produces escaped HTML with headings and blockquotes', () => {
    const html = buildProjectHtml(detail, 'mla')
    expect(html).toContain('<h1>Climate Essay</h1>')
    expect(html).toContain('<blockquote>')
  })
})
