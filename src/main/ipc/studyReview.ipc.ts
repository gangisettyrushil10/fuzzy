import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import {
  getQuizAttemptStats,
  insertQuizAttempt,
  listQuizAttemptsForDocument,
  type CreateQuizAttemptInput
} from '../db/repositories/quizAttemptRepository'
import {
  countDueCards,
  getReviewsForPack,
  gradeCard,
  listDueCards
} from '../db/repositories/flashcardReviewRepository'
import type { QuizAttemptAnswer, ReviewGrade } from '@shared/types/database'

const GRADES: ReviewGrade[] = ['again', 'hard', 'good', 'easy']

function sanitizeAnswers(raw: unknown): QuizAttemptAnswer[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((a): a is QuizAttemptAnswer => a !== null && typeof a === 'object')
    .map((a) => ({
      questionIndex: Number((a as QuizAttemptAnswer).questionIndex) || 0,
      given: String((a as QuizAttemptAnswer).given ?? ''),
      correct: Boolean((a as QuizAttemptAnswer).correct)
    }))
}

export function registerStudyReviewIpc(): void {
  // --- Quiz attempts ---
  ipcMain.handle(IpcChannels.quizAttemptsSave, (_e, input: unknown) => {
    const i = (input ?? {}) as Partial<CreateQuizAttemptInput>
    if (typeof i.studyPackId !== 'string' || !i.studyPackId) {
      throw new Error('studyPackId is required.')
    }
    if (typeof i.documentId !== 'string' || !i.documentId) {
      throw new Error('documentId is required.')
    }
    const total = Math.max(0, Math.round(Number(i.total) || 0))
    const score = Math.max(0, Math.min(total, Math.round(Number(i.score) || 0)))
    return insertQuizAttempt({
      studyPackId: i.studyPackId,
      documentId: i.documentId,
      score,
      total,
      answers: sanitizeAnswers(i.answers),
      startedAt: typeof i.startedAt === 'string' ? i.startedAt : new Date().toISOString()
    })
  })

  ipcMain.handle(IpcChannels.quizAttemptsList, (_e, documentId: unknown) => {
    if (typeof documentId !== 'string' || !documentId) return []
    return listQuizAttemptsForDocument(documentId)
  })

  ipcMain.handle(IpcChannels.quizAttemptsStats, (_e, documentId: unknown) => {
    if (typeof documentId !== 'string' || !documentId) {
      return { attempts: 0, bestPct: 0, lastPct: 0 }
    }
    return getQuizAttemptStats(documentId)
  })

  // --- Flashcard spaced repetition ---
  ipcMain.handle(IpcChannels.flashcardReviewsForPack, (_e, studyPackId: unknown) => {
    if (typeof studyPackId !== 'string' || !studyPackId) return {}
    return getReviewsForPack(studyPackId)
  })

  ipcMain.handle(
    IpcChannels.flashcardReviewsGrade,
    (_e, studyPackId: unknown, documentId: unknown, cardIndex: unknown, grade: unknown) => {
      if (typeof studyPackId !== 'string' || !studyPackId) throw new Error('studyPackId is required.')
      if (typeof documentId !== 'string' || !documentId) throw new Error('documentId is required.')
      const idx = Math.max(0, Math.round(Number(cardIndex) || 0))
      const g = GRADES.includes(grade as ReviewGrade) ? (grade as ReviewGrade) : 'good'
      return gradeCard(studyPackId, documentId, idx, g)
    }
  )

  ipcMain.handle(IpcChannels.flashcardReviewsDue, (_e, limit: unknown) => {
    const cap = typeof limit === 'number' && limit > 0 ? Math.min(500, Math.round(limit)) : 100
    return listDueCards(new Date().toISOString(), cap)
  })

  ipcMain.handle(IpcChannels.flashcardReviewsDueCount, () => {
    return countDueCards(new Date().toISOString())
  })
}
