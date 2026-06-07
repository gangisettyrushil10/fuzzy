// Pure helpers for "Ask the book" (no electron/openai/db imports — unit-tested).
// The mock answer is extractive: it stitches the top retrieved snippets into a
// readable, honestly-hedged response so the feature works with no API key.

import type { RankedPassage } from '@shared/types/database'

export function buildExtractiveAnswer(question: string, passages: RankedPassage[]): string {
  if (passages.length === 0) {
    return `I couldn't find anything in this document that addresses "${question.trim()}".`
  }
  const top = passages.slice(0, 3)
  const lines = top.map((p) => `• "${p.snippet.trim()}" (p. ${p.pageNumber})`)
  return [
    'Based on the most relevant passages in this document:',
    '',
    ...lines,
    '',
    'These are the closest matches — open them in place to read them in context.'
  ].join('\n')
}

// Build the numbered passage block the LLM answerer reads (referenced by Pn).
export function buildPassageBlock(passages: RankedPassage[]): string {
  return passages
    .map((p, i) => `P${i + 1} (p. ${p.pageNumber}): ${p.snippet}`)
    .join('\n')
}
