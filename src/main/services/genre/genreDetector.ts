// Pure heuristic genre classifier (no electron/openai/db imports — unit-tested).
// Cheap signal counting over a sample of the document; selects the genre adapter
// (segmentation/entity-kind/locator/prompt-library). Conservative: returns null
// when nothing scores, so callers can leave genre unclassified.

import type { DocumentGenre, ExtractedDocument } from '@shared/types/database'

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length
}

interface GenreScores {
  fiction: number
  paper: number
  textbook: number
  news: number
  play: number
  transcript: number
}

// Exposed for tests/inspection — returns the raw signal scores.
export function scoreGenres(extracted: ExtractedDocument): GenreScores {
  const sample = extracted.pages
    .slice(0, 12)
    .map((p) => p.textContent ?? '')
    .join('\n')
  const words = Math.max(1, sample.split(/\s+/).length)

  const quotes = countMatches(sample, /[“"]/g)
  const dialogueTags = countMatches(sample, /\b(said|asked|replied|whispered|murmured|exclaimed)\b/gi)

  const paperSections = countMatches(
    sample,
    /\b(abstract|introduction|methodology|methods|results|discussion|conclusion|references|bibliography)\b/gi
  )
  const paperCites = countMatches(sample, /(et al\.?|doi:|\(\d{4}\))/gi)

  const playActScene = countMatches(sample, /\b(act|scene)\s+[ivxlc\d]+/gi)
  const playStage = countMatches(sample, /\b(enter|exeunt|exit)\b/gi)
  const allCapsSpeakers = countMatches(sample, /^[A-Z][A-Z .]{2,20}\.?$/gm)

  const timestamps = countMatches(sample, /(^|\s)\[?\d{1,2}:\d{2}(:\d{2})?\]?/gm)
  // Speaker turns may be bare ("ALICE:") or timestamp-prefixed ("00:01 ALICE:").
  const speakerTurns = countMatches(
    sample,
    /^\s*(?:\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s+)?[A-Z][A-Za-z .'-]{1,24}:\s/gm
  )

  const textbookCues = countMatches(
    sample,
    /\b(chapter|exercise|exercises|figure|table|example|definition|theorem|problem set|key terms|review questions)\b/gi
  )

  const byline = countMatches(sample, /^by\s+[A-Z][a-z]+/gim)
  const wire = countMatches(sample, /\b(reuters|associated press|\(ap\)|bloomberg)\b/gi)

  return {
    fiction: (quotes + dialogueTags * 4) / words * 1000,
    paper: paperSections * 2 + paperCites,
    textbook: textbookCues,
    news: byline * 3 + wire * 2,
    play: playActScene * 3 + playStage + allCapsSpeakers,
    transcript: timestamps + speakerTurns * 2
  }
}

export function detectGenre(extracted: ExtractedDocument): DocumentGenre | null {
  const sample = extracted.pages
    .slice(0, 12)
    .map((p) => p.textContent ?? '')
    .join('\n')
  if (sample.trim().length < 200) return null

  const s = scoreGenres(extracted)
  // Thresholds tuned to require a real signal, not a single incidental match.
  const candidates: Array<{ genre: DocumentGenre; score: number; min: number }> = [
    { genre: 'transcript', score: s.transcript, min: 6 },
    { genre: 'play', score: s.play, min: 6 },
    { genre: 'paper', score: s.paper, min: 6 },
    { genre: 'news', score: s.news, min: 4 },
    { genre: 'textbook', score: s.textbook, min: 4 },
    { genre: 'fiction', score: s.fiction, min: 2 }
  ]
  const passing = candidates.filter((c) => c.score >= c.min).sort((a, b) => b.score / b.min - a.score / a.min)
  if (passing.length > 0) return passing[0].genre
  // Substantial prose with no genre signal → general non-fiction.
  return sample.split(/\s+/).length > 300 ? 'nonfiction' : null
}
