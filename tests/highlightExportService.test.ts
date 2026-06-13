import { describe, expect, it } from 'vitest'
import type { HighlightRecord } from '../src/shared/types/database'
import {
  exportExtensionForTarget,
  exportHighlightsText
} from '../src/main/services/highlights/highlightExportService'

const sample: HighlightRecord = {
  id: 'h1',
  sourceKind: 'kindle',
  contentKind: 'book',
  sourceLabel: 'Kindle',
  sourceTitle: 'Deep Work',
  sourceAuthor: 'Cal Newport',
  sourceUrl: 'https://example.com/book',
  sourceLocation: 'page 42',
  externalId: null,
  text: 'Clarity about what matters provides clarity about what does not.',
  note: 'Good product principle.',
  tags: ['focus', 'product'],
  isFavorite: true,
  metadata: {},
  highlightedAt: '2026-06-13T00:00:00.000Z',
  createdAt: '2026-06-13T00:00:00.000Z',
  updatedAt: '2026-06-13T00:00:00.000Z',
  review: {
    ease: 2.5,
    intervalDays: 0,
    repetitions: 0,
    dueAt: '2026-06-13T00:00:00.000Z',
    lastReviewedAt: null
  }
}

describe('exportHighlightsText', () => {
  it('builds a notion-ready csv export', () => {
    const text = exportHighlightsText([sample], 'notion')
    expect(text).toContain('Source,Author,Highlight,Note')
    expect(text).toContain('Deep Work')
    expect(text).toContain('Good product principle.')
  })

  it('builds grouped markdown for obsidian/logseq-style targets', () => {
    const text = exportHighlightsText([sample], 'obsidian')
    expect(text).toContain('# Fuzzy Highlights Export')
    expect(text).toContain('## Deep Work — Cal Newport')
    expect(text).toContain('#focus')
  })

  it('builds roam bullets', () => {
    const text = exportHighlightsText([sample], 'roam')
    expect(text).toContain('- Fuzzy highlights')
    expect(text).toContain('Note:: Good product principle.')
  })
})

describe('exportExtensionForTarget', () => {
  it('maps targets to stable file extensions', () => {
    expect(exportExtensionForTarget('notion')).toBe('csv')
    expect(exportExtensionForTarget('evernote')).toBe('html')
    expect(exportExtensionForTarget('obsidian')).toBe('md')
  })
})
