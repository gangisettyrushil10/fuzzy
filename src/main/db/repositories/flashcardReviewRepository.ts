import { randomUUID } from 'crypto'
import { getDb } from '../../services/dbService'
import type {
  DueCard,
  Flashcard,
  FlashcardReviewState,
  ReviewGrade
} from '@shared/types/database'
import { initialReviewState, scheduleNext } from '../../services/study/spacedRepetition'

interface ReviewRow {
  id: string
  study_pack_id: string
  document_id: string
  card_index: number
  ease: number
  interval_days: number
  repetitions: number
  due_at: string
  last_reviewed_at: string | null
}

function toState(row: ReviewRow): FlashcardReviewState {
  return {
    ease: row.ease,
    intervalDays: row.interval_days,
    repetitions: row.repetitions,
    dueAt: row.due_at,
    lastReviewedAt: row.last_reviewed_at
  }
}

// Map of card_index -> scheduling state for a pack (only cards reviewed at least
// once have a row; the rest are treated as brand-new / due now by the caller).
export function getReviewsForPack(studyPackId: string): Record<number, FlashcardReviewState> {
  const rows = getDb()
    .prepare(`SELECT * FROM flashcard_reviews WHERE study_pack_id = ?`)
    .all(studyPackId) as ReviewRow[]
  const out: Record<number, FlashcardReviewState> = {}
  for (const row of rows) out[row.card_index] = toState(row)
  return out
}

function upsertReview(
  studyPackId: string,
  documentId: string,
  cardIndex: number,
  state: FlashcardReviewState
): void {
  getDb()
    .prepare(
      `INSERT INTO flashcard_reviews (
        id, study_pack_id, document_id, card_index, ease, interval_days,
        repetitions, due_at, last_reviewed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(study_pack_id, card_index) DO UPDATE SET
        ease = excluded.ease,
        interval_days = excluded.interval_days,
        repetitions = excluded.repetitions,
        due_at = excluded.due_at,
        last_reviewed_at = excluded.last_reviewed_at`
    )
    .run(
      randomUUID(),
      studyPackId,
      documentId,
      cardIndex,
      state.ease,
      state.intervalDays,
      state.repetitions,
      state.dueAt,
      state.lastReviewedAt,
      new Date().toISOString()
    )
}

// Grade a card and persist the next schedule. Returns the new state so the UI
// can show the next due date. documentId is needed to seed a first-time row.
export function gradeCard(
  studyPackId: string,
  documentId: string,
  cardIndex: number,
  grade: ReviewGrade
): FlashcardReviewState {
  const existing = getDb()
    .prepare(`SELECT * FROM flashcard_reviews WHERE study_pack_id = ? AND card_index = ?`)
    .get(studyPackId, cardIndex) as ReviewRow | undefined
  const prev = existing ? toState(existing) : initialReviewState()
  const next = scheduleNext(prev, grade)
  upsertReview(studyPackId, documentId, cardIndex, next)
  return next
}

// Cards due across all documents (the cross-doc "review queue"). A card with no
// review row has never been studied → it is due now. Hydrates content from the
// owning pack's flashcards_json. `limit` caps the queue size.
export function listDueCards(nowIso: string, limit = 100): DueCard[] {
  const rows = getDb()
    .prepare(
      `SELECT sp.id AS study_pack_id, sp.document_id AS document_id,
              COALESCE(d.title, sp.title) AS document_title,
              sp.flashcards_json AS flashcards_json,
              fr.card_index AS card_index, fr.due_at AS due_at
       FROM study_packs sp
       JOIN documents d ON d.id = sp.document_id
       LEFT JOIN flashcard_reviews fr ON fr.study_pack_id = sp.id`
    )
    .all() as Array<{
    study_pack_id: string
    document_id: string
    document_title: string
    flashcards_json: string | null
    card_index: number | null
    due_at: string | null
  }>

  // Group rows by pack so we can parse each flashcards_json once.
  const packs = new Map<
    string,
    { documentId: string; documentTitle: string; cards: Flashcard[]; reviewed: Map<number, string> }
  >()
  for (const r of rows) {
    let entry = packs.get(r.study_pack_id)
    if (!entry) {
      let cards: Flashcard[] = []
      try {
        cards = r.flashcards_json ? (JSON.parse(r.flashcards_json) as Flashcard[]) : []
      } catch {
        cards = []
      }
      entry = {
        documentId: r.document_id,
        documentTitle: r.document_title,
        cards,
        reviewed: new Map()
      }
      packs.set(r.study_pack_id, entry)
    }
    if (r.card_index !== null && r.due_at !== null) entry.reviewed.set(r.card_index, r.due_at)
  }

  const due: DueCard[] = []
  for (const [studyPackId, entry] of packs) {
    entry.cards.forEach((card, cardIndex) => {
      const reviewedDue = entry.reviewed.get(cardIndex)
      const dueAt = reviewedDue ?? '1970-01-01T00:00:00.000Z' // never studied → due now
      if (dueAt <= nowIso) {
        due.push({
          studyPackId,
          documentId: entry.documentId,
          documentTitle: entry.documentTitle,
          cardIndex,
          card,
          dueAt
        })
      }
    })
  }

  // Soonest-due first (oldest dueAt), then cap.
  due.sort((a, b) => (a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0))
  return due.slice(0, limit)
}

export function countDueCards(nowIso: string): number {
  return listDueCards(nowIso, Number.MAX_SAFE_INTEGER).length
}
