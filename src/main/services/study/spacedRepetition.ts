import type { FlashcardReviewState, ReviewGrade } from '@shared/types/database'

// SM-2 lite. A pragmatic, Anki-flavoured variant of SuperMemo-2: the ease
// factor floats with answer quality and the interval grows geometrically once a
// card graduates. Pure + deterministic given (state, grade, now) so it's unit
// testable; the repository owns persistence.

const MIN_EASE = 1.3
const DEFAULT_EASE = 2.5
// A lapse ("again") re-surfaces the card in the same session rather than days
// out — short enough to count as "due today", long enough to space within a run.
const LAPSE_MINUTES = 10

export function initialReviewState(now: Date = new Date()): FlashcardReviewState {
  return {
    ease: DEFAULT_EASE,
    intervalDays: 0,
    repetitions: 0,
    dueAt: now.toISOString(),
    lastReviewedAt: null
  }
}

function addDays(now: Date, days: number): string {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

function clampEase(ease: number): number {
  return Math.max(MIN_EASE, Number.isFinite(ease) ? ease : DEFAULT_EASE)
}

// Apply a grade to a card's schedule, returning the next state. `prev` may be a
// partial/legacy shape; missing fields fall back to a fresh card.
export function scheduleNext(
  prev: Partial<FlashcardReviewState> | null,
  grade: ReviewGrade,
  now: Date = new Date()
): FlashcardReviewState {
  const ease = clampEase(typeof prev?.ease === 'number' ? prev.ease : DEFAULT_EASE)
  const repetitions = typeof prev?.repetitions === 'number' && prev.repetitions > 0 ? prev.repetitions : 0
  const intervalDays = typeof prev?.intervalDays === 'number' && prev.intervalDays > 0 ? prev.intervalDays : 0
  const nowIso = now.toISOString()

  if (grade === 'again') {
    return {
      ease: clampEase(ease - 0.2),
      intervalDays: 0,
      repetitions: 0,
      dueAt: new Date(now.getTime() + LAPSE_MINUTES * 60 * 1000).toISOString(),
      lastReviewedAt: nowIso
    }
  }

  let nextEase = ease
  let nextInterval: number

  if (grade === 'hard') {
    nextEase = clampEase(ease - 0.15)
    nextInterval = Math.max(1, Math.round((intervalDays || 1) * 1.2))
  } else if (grade === 'easy') {
    nextEase = clampEase(ease + 0.15)
    nextInterval = repetitions === 0 ? 4 : Math.round((intervalDays || 1) * nextEase * 1.3)
  } else {
    // good
    if (repetitions === 0) nextInterval = 1
    else if (repetitions === 1) nextInterval = 6
    else nextInterval = Math.round((intervalDays || 1) * ease)
  }

  return {
    ease: nextEase,
    intervalDays: nextInterval,
    repetitions: repetitions + 1,
    dueAt: addDays(now, nextInterval),
    lastReviewedAt: nowIso
  }
}
