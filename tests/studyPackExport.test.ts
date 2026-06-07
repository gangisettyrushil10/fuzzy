import { describe, it, expect } from 'vitest'
import {
  buildAnkiText,
  buildCsv,
  buildMarkdown,
  buildQuizletText,
  extensionForFormat,
  packToCards
} from '../src/main/services/export/studyPackExportService'
import type { StudyPackRecord } from '../src/shared/types/database'

const pack: StudyPackRecord = {
  id: 'sp1',
  documentId: 'd1',
  title: 'On the Origin',
  summary: 'A summary.',
  keyConcepts: ['natural selection'],
  flashcards: [
    { question: 'Define evolution', answer: 'Change over time', kind: 'qa' },
    { question: 'The species, ____, varies.', answer: 'finch', kind: 'cloze' }
  ],
  quiz: [
    {
      question: 'Who wrote it?',
      answer: 'Darwin',
      difficulty: 'easy',
      format: 'multiple_choice',
      choices: ['Darwin', 'Wallace', 'Lamarck'],
      correctIndex: 0,
      category: 'concepts'
    },
    {
      question: 'Summarize, with a comma, the thesis.',
      answer: 'Descent, with modification',
      difficulty: 'hard',
      format: 'short_answer',
      category: 'arguments'
    }
  ],
  options: null,
  createdAt: 't'
}

describe('studyPackExportService', () => {
  it('flattens flashcards then quiz into front/back cards', () => {
    const cards = packToCards(pack)
    expect(cards).toHaveLength(4)
    expect(cards[0]).toEqual({ front: 'Define evolution', back: 'Change over time' })
    // MCQ back resolves to the correct choice text.
    expect(cards[2]).toEqual({ front: 'Who wrote it?', back: 'Darwin' })
  })

  it('Quizlet text is tab-separated, one card per line', () => {
    const text = buildQuizletText(pack)
    const lines = text.split('\n')
    expect(lines).toHaveLength(4)
    expect(lines[0]).toBe('Define evolution\tChange over time')
    expect(lines[0].split('\t')).toHaveLength(2)
  })

  it('Anki text matches Quizlet TSV', () => {
    expect(buildAnkiText(pack)).toBe(buildQuizletText(pack))
  })

  it('CSV quotes cells containing commas and uses CRLF rows + header', () => {
    const csv = buildCsv(pack)
    const rows = csv.split('\r\n')
    expect(rows[0]).toBe('Front,Back')
    // The short-answer back has commas → must be quoted.
    expect(csv).toContain('"Descent, with modification"')
  })

  it('markdown includes the correct-answer marker for MCQ', () => {
    const md = buildMarkdown(pack)
    expect(md).toContain('# On the Origin — Study Pack')
    expect(md).toContain('A. Darwin ✓')
  })

  it('maps formats to file extensions', () => {
    expect(extensionForFormat('csv')).toBe('csv')
    expect(extensionForFormat('markdown')).toBe('md')
    expect(extensionForFormat('quizlet')).toBe('txt')
    expect(extensionForFormat('anki')).toBe('txt')
  })
})
