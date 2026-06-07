// Pure essay helpers (no electron/openai/db imports — unit-tested). Maps a
// SynthesisResult into an essay outline (the synthesis engine already did the
// real retrieval + citations), stitches evidence into paragraphs for the no-key
// path, and compiles the whole thing to Markdown.

import type {
  CitationFormat,
  EssayOutline,
  EssaySection,
  SynthesisResult
} from '@shared/types/database'

// A synthesis (thesis → cited sub-claims + tensions) IS an essay skeleton:
// sub-claims become body paragraphs, tensions become a counterargument.
export function synthesisToOutline(thesis: string, synthesis: SynthesisResult): EssayOutline {
  const sections: EssaySection[] = []

  sections.push({
    id: 's-intro',
    kind: 'introduction',
    heading: 'Introduction',
    point: synthesis.summary
      ? `This essay argues that ${thesis} ${synthesis.summary}`
      : `This essay argues that ${thesis}`,
    evidence: []
  })

  synthesis.subClaims.forEach((sc, i) => {
    sections.push({
      id: `s-body-${i}`,
      kind: 'body',
      heading: `Body ${i + 1}`,
      point: sc.claim,
      evidence: sc.evidence
    })
  })

  if (synthesis.tensions.length > 0) {
    sections.push({
      id: 's-counter',
      kind: 'counterargument',
      heading: 'Counterargument',
      point: `Some sources complicate this view: ${synthesis.tensions.join('; ')}.`,
      evidence: []
    })
  }

  sections.push({
    id: 's-conclusion',
    kind: 'conclusion',
    heading: 'Conclusion',
    point: `Taken together, the evidence supports the claim that ${thesis}`,
    evidence: []
  })

  return { thesis, sections }
}

// Extractive paragraph for the no-key path: lead with the point, then weave in
// up to three real quotes with their citation in the requested format.
export function buildParagraphFromSection(
  section: EssaySection,
  citationFormat: CitationFormat
): string {
  const lead = section.point.trim().replace(/\.?$/, '.')
  if (section.evidence.length === 0) return lead
  const sentences = section.evidence.slice(0, 3).map((e) => {
    const cite = e.citations[citationFormat]
    return `As one source notes, "${e.quote.trim()}" (${cite}).`
  })
  return [lead, ...sentences].join(' ')
}

// Compile the (possibly partially-drafted) outline into a Markdown essay. Falls
// back to a section's point when it hasn't been drafted yet.
export function compileDraft(title: string, outline: EssayOutline): string {
  const body = outline.sections
    .map((s) => (s.draft && s.draft.trim() ? s.draft.trim() : s.point.trim()))
    .filter(Boolean)
    .join('\n\n')
  return `# ${title}\n\n${body}\n`
}
