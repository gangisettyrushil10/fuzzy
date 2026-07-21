import { describe, expect, it } from 'vitest'
import {
  buildAiNoteBlock,
  buildHighlightBlock,
  pickNoteFilename,
  slugifyNoteTitle
} from '../src/shared/obsidian'
import { normalizeObsidianPrefs } from '../src/shared/types/database'

describe('slugifyNoteTitle', () => {
  it('keeps spaces and hyphens for readable filenames', () => {
    expect(slugifyNoteTitle('Attention Is All You Need')).toBe('Attention Is All You Need')
    expect(slugifyNoteTitle('GraphSAGE - inductive learning')).toBe(
      'GraphSAGE - inductive learning'
    )
  })

  it('strips path separators and reserved characters', () => {
    expect(slugifyNoteTitle('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij')
  })

  it('collapses whitespace and trims edges', () => {
    expect(slugifyNoteTitle('  hello   world  ')).toBe('hello world')
  })

  it('falls back to Untitled for empty or symbol-only titles', () => {
    expect(slugifyNoteTitle('')).toBe('Untitled')
    expect(slugifyNoteTitle('///')).toBe('Untitled')
  })
})

describe('pickNoteFilename', () => {
  it('uses the plain name when nothing is taken', () => {
    expect(pickNoteFilename('Paper', [])).toBe('Paper.md')
  })

  it('adopts an existing name that is not claimed by another doc', () => {
    // Only the `taken` set is deduped against — an unmapped on-disk file is reused.
    expect(pickNoteFilename('Paper', [])).toBe('Paper.md')
  })

  it('increments when the name is already claimed', () => {
    expect(pickNoteFilename('Paper', ['Paper.md'])).toBe('Paper-2.md')
    expect(pickNoteFilename('Paper', ['Paper.md', 'Paper-2.md'])).toBe('Paper-3.md')
  })
})

describe('markdown block builders', () => {
  it('formats a highlight block with page, quote, and note', () => {
    expect(buildHighlightBlock({ text: 'message passing', note: 'core idea', pageNumber: 4 })).toBe(
      '## Highlight — p.4\n\n> message passing\n\ncore idea'
    )
  })

  it('omits the note line when there is no note', () => {
    expect(buildHighlightBlock({ text: 'oversmoothing', pageNumber: 2 })).toBe(
      '## Highlight — p.2\n\n> oversmoothing'
    )
  })

  it('formats an AI note block with the source passage quoted', () => {
    expect(
      buildAiNoteBlock({
        text: 'It scales to large graphs.',
        selectedText: 'GraphSAGE',
        pageNumber: 7
      })
    ).toBe('## Note (AI) — p.7\n\n> GraphSAGE\n\nIt scales to large graphs.')
  })

  it('drops the page suffix when no page is given', () => {
    expect(buildHighlightBlock({ text: 'x' })).toBe('## Highlight\n\n> x')
  })
})

describe('normalizeObsidianPrefs', () => {
  it('returns defaults for junk input', () => {
    expect(normalizeObsidianPrefs(null)).toEqual({
      vaultPath: null,
      subfolder: 'Fuzzy',
      notePaths: {}
    })
  })

  it('nulls an empty/whitespace vault path', () => {
    expect(normalizeObsidianPrefs({ vaultPath: '   ' }).vaultPath).toBeNull()
  })

  it('keeps safe note filenames (spaces and hyphens allowed)', () => {
    const prefs = normalizeObsidianPrefs({
      notePaths: { doc1: 'Attention Is All You Need.md', doc2: 'GCN-vs-GraphSAGE.md' }
    })
    expect(prefs.notePaths).toEqual({
      doc1: 'Attention Is All You Need.md',
      doc2: 'GCN-vs-GraphSAGE.md'
    })
  })

  it('drops note filenames that could escape the notes folder', () => {
    const prefs = normalizeObsidianPrefs({
      notePaths: {
        traversal: '../secrets.md',
        nested: 'sub/dir.md',
        dot: '..',
        ok: 'Fine.md'
      }
    })
    expect(prefs.notePaths).toEqual({ ok: 'Fine.md' })
  })

  it('sanitizes a subfolder with path separators back to a safe segment', () => {
    expect(normalizeObsidianPrefs({ subfolder: 'a/b:c' }).subfolder).toBe('abc')
    expect(normalizeObsidianPrefs({ subfolder: '   ' }).subfolder).toBe('Fuzzy')
  })
})
