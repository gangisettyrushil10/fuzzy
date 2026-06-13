import { describe, expect, it } from 'vitest'
import { parseHighlightImport } from '../src/main/services/highlights/highlightImportParsers'

describe('parseHighlightImport', () => {
  it('parses Kindle My Clippings exports', () => {
    const raw = [
      'Deep Work (Cal Newport)',
      '- Your Highlight on page 42 | location 623-624 | Added on Tuesday, January 2, 2024 8:00:00 PM',
      '',
      'Clarity about what matters provides clarity about what does not.',
      '=========='
    ].join('\n')

    const parsed = parseHighlightImport('My Clippings.txt', raw)
    expect(parsed.sourceKind).toBe('kindle')
    expect(parsed.items).toHaveLength(1)
    expect(parsed.items[0]?.sourceTitle).toBe('Deep Work')
    expect(parsed.items[0]?.sourceAuthor).toBe('Cal Newport')
    expect(parsed.items[0]?.sourceLocation).toContain('page 42')
  })

  it('parses Instapaper-style CSV exports', () => {
    const raw = [
      'Title,URL,Selection,Note,Tags',
      '"A Better Reading Workflow","https://example.com/article","Readers forget what they never revisit.","Use this in Fuzzy","workflow,retention"'
    ].join('\n')

    const parsed = parseHighlightImport('instapaper-highlights.csv', raw)
    expect(parsed.sourceKind).toBe('instapaper')
    expect(parsed.items).toHaveLength(1)
    expect(parsed.items[0]?.contentKind).toBe('article')
    expect(parsed.items[0]?.tags).toEqual(['workflow', 'retention'])
  })

  it('parses generic JSON exports', () => {
    const raw = JSON.stringify({
      highlights: [
        {
          title: 'Research Paper',
          author: 'A. Scholar',
          highlight: 'A useful result',
          note: 'Follow up later',
          tags: 'paper,method'
        }
      ]
    })

    const parsed = parseHighlightImport('library.json', raw)
    expect(parsed.sourceKind).toBe('generic_json')
    expect(parsed.items[0]?.sourceTitle).toBe('Research Paper')
    expect(parsed.items[0]?.note).toBe('Follow up later')
  })
})
