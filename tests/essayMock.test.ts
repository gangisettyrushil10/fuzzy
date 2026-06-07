import { describe, it, expect } from 'vitest'
import {
  buildParagraphFromSection,
  compileDraft,
  synthesisToOutline
} from '../src/main/services/essay/essayMock'
import type {
  CitationFormat,
  EssaySection,
  SynthesisEvidence,
  SynthesisResult
} from '../src/shared/types/database'

const cites = (mla: string): Record<CitationFormat, string> => ({
  mla,
  apa: 'APA',
  chicago: 'Chicago',
  harvard: 'Harvard'
})

function evidence(quote: string, page: number, mla: string): SynthesisEvidence {
  return { quote, documentId: 'd', documentTitle: 'Doc', pageNumber: page, citations: cites(mla) }
}

const SYNTHESIS: SynthesisResult = {
  thesis: 'private thought survives oppression',
  subClaims: [
    { claim: 'The diary is an act of resistance', evidence: [evidence('he wrote in the diary', 3, 'Orwell 3')] },
    { claim: 'Memory defies the Party', evidence: [evidence('he remembered his mother', 8, 'Orwell 8')] }
  ],
  tensions: ['Winston ultimately conforms'],
  summary: 'across the novel.',
  consideredPassageCount: 12
}

describe('synthesisToOutline', () => {
  it('maps a synthesis into an essay skeleton with intro/body/counter/conclusion', () => {
    const outline = synthesisToOutline(SYNTHESIS.thesis, SYNTHESIS)
    const kinds = outline.sections.map((s) => s.kind)
    expect(kinds).toEqual(['introduction', 'body', 'body', 'counterargument', 'conclusion'])
    // Body sections carry the real cited evidence.
    const firstBody = outline.sections.find((s) => s.kind === 'body')!
    expect(firstBody.evidence[0].citations.mla).toBe('Orwell 3')
    expect(outline.thesis).toBe(SYNTHESIS.thesis)
  })

  it('omits the counterargument when there are no tensions', () => {
    const outline = synthesisToOutline('t', { ...SYNTHESIS, tensions: [] })
    expect(outline.sections.some((s) => s.kind === 'counterargument')).toBe(false)
  })
})

describe('buildParagraphFromSection', () => {
  const bodySection: EssaySection = {
    id: 's-body-0',
    kind: 'body',
    heading: 'Body 1',
    point: 'The diary is an act of resistance',
    evidence: [evidence('he wrote in the diary', 3, 'Orwell 3')]
  }

  it('weaves the real quote and exact citation into the paragraph', () => {
    const p = buildParagraphFromSection(bodySection, 'mla')
    expect(p).toContain('he wrote in the diary')
    expect(p).toContain('(Orwell 3)')
  })

  it('returns just the point when there is no evidence', () => {
    const intro: EssaySection = { id: 'i', kind: 'introduction', heading: 'Introduction', point: 'Hook here', evidence: [] }
    expect(buildParagraphFromSection(intro, 'mla')).toBe('Hook here.')
  })
})

describe('compileDraft', () => {
  it('assembles a Markdown draft, preferring drafted paragraphs over points', () => {
    const outline = synthesisToOutline(SYNTHESIS.thesis, SYNTHESIS)
    outline.sections[0].draft = 'A polished intro paragraph.'
    const md = compileDraft('My Essay', outline)
    expect(md).toContain('# My Essay')
    expect(md).toContain('A polished intro paragraph.')
    // Undrafted sections fall back to their point text.
    expect(md).toContain('The diary is an act of resistance')
  })
})
