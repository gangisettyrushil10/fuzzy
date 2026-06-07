// Renders a StudyPack to paste-/import-ready text for external study tools.
// Pure functions so they unit-test without a DB or filesystem.
//
// Quizlet has no public write API; its Create flow imports pasted text where the
// term and definition are separated by a chosen delimiter (Tab) and cards by a
// newline. Anki's text importer is the same TSV shape (front<TAB>back). CSV is
// RFC-4180 for spreadsheets / other tools.

import type { QuizQuestion, StudyExportFormat, StudyPackRecord } from '@shared/types/database'

export interface ExportCard {
  front: string
  back: string
}

// One-line answer for a quiz question: for multiple-choice we prefer the
// resolved correct option text, falling back to the free-form answer.
function quizBack(q: QuizQuestion): string {
  if (
    q.format === 'multiple_choice' &&
    Array.isArray(q.choices) &&
    typeof q.correctIndex === 'number' &&
    q.choices[q.correctIndex]
  ) {
    return q.choices[q.correctIndex]
  }
  return q.answer
}

// Flatten a pack into front/back cards: flashcards first, then quiz questions.
export function packToCards(pack: StudyPackRecord): ExportCard[] {
  const cards: ExportCard[] = pack.flashcards.map((f) => ({ front: f.question, back: f.answer }))
  for (const q of pack.quiz) cards.push({ front: q.question, back: quizBack(q) })
  return cards
}

// Collapse tabs/newlines so a value can't break the row/column structure of TSV.
function oneLine(s: string): string {
  return s.replace(/[\t\r\n]+/g, ' ').trim()
}

// Quizlet "Import" paste format: term<TAB>definition, one card per line.
export function buildQuizletText(pack: StudyPackRecord): string {
  return packToCards(pack)
    .map((c) => `${oneLine(c.front)}\t${oneLine(c.back)}`)
    .join('\n')
}

// Anki text importer: identical front<TAB>back TSV (newline between notes).
export function buildAnkiText(pack: StudyPackRecord): string {
  return buildQuizletText(pack)
}

function csvCell(s: string): string {
  const needsQuote = /[",\r\n]/.test(s)
  const escaped = s.replace(/"/g, '""')
  return needsQuote ? `"${escaped}"` : escaped
}

// RFC-4180 CSV with a header row.
export function buildCsv(pack: StudyPackRecord): string {
  const rows = [['Front', 'Back'], ...packToCards(pack).map((c) => [c.front, c.back])]
  return rows.map((cols) => cols.map(csvCell).join(',')).join('\r\n')
}

// A human-readable study sheet (summary + concepts + cards + quiz with answers).
export function buildMarkdown(pack: StudyPackRecord): string {
  const out: string[] = [`# ${pack.title} — Study Pack`]
  if (pack.summary?.trim()) out.push(`\n${pack.summary.trim()}`)

  if (pack.keyConcepts.length > 0) {
    out.push('\n## Key concepts')
    for (const c of pack.keyConcepts) out.push(`- ${c}`)
  }

  if (pack.flashcards.length > 0) {
    out.push('\n## Flashcards')
    for (const f of pack.flashcards) out.push(`\n**${f.question}**\n\n${f.answer}`)
  }

  if (pack.quiz.length > 0) {
    out.push('\n## Quiz')
    pack.quiz.forEach((q, i) => {
      out.push(`\n${i + 1}. ${q.question} _(${q.difficulty})_`)
      if (q.format === 'multiple_choice' && Array.isArray(q.choices)) {
        q.choices.forEach((choice, ci) => {
          const mark = ci === q.correctIndex ? ' ✓' : ''
          out.push(`   - ${String.fromCharCode(65 + ci)}. ${choice}${mark}`)
        })
      } else {
        out.push(`   - Answer: ${q.answer}`)
      }
    })
  }

  return out.join('\n')
}

// File extension for a given export format (drives the save dialog default name).
export function extensionForFormat(format: StudyExportFormat): string {
  switch (format) {
    case 'csv':
      return 'csv'
    case 'markdown':
      return 'md'
    case 'quizlet':
    case 'anki':
    default:
      return 'txt'
  }
}

export function buildStudyExport(pack: StudyPackRecord, format: StudyExportFormat): string {
  switch (format) {
    case 'anki':
      return buildAnkiText(pack)
    case 'csv':
      return buildCsv(pack)
    case 'markdown':
      return buildMarkdown(pack)
    case 'quizlet':
    default:
      return buildQuizletText(pack)
  }
}
