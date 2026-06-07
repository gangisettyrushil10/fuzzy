import { describe, it, expect } from 'vitest'
import {
  initialReviewState,
  scheduleNext
} from '../src/main/services/study/spacedRepetition'

const NOW = new Date('2026-06-07T12:00:00.000Z')

function daysBetween(a: string, b: Date): number {
  return Math.round((new Date(a).getTime() - b.getTime()) / (24 * 60 * 60 * 1000))
}

describe('spacedRepetition.scheduleNext', () => {
  it('a fresh card is due immediately', () => {
    const s = initialReviewState(NOW)
    expect(s.repetitions).toBe(0)
    expect(s.dueAt).toBe(NOW.toISOString())
  })

  it('"good" on a new card schedules it one day out', () => {
    const next = scheduleNext(initialReviewState(NOW), 'good', NOW)
    expect(next.repetitions).toBe(1)
    expect(daysBetween(next.dueAt, NOW)).toBe(1)
  })

  it('"good" twice graduates to a 6-day interval', () => {
    const first = scheduleNext(initialReviewState(NOW), 'good', NOW)
    const second = scheduleNext(first, 'good', NOW)
    expect(second.repetitions).toBe(2)
    expect(daysBetween(second.dueAt, NOW)).toBe(6)
  })

  it('"easy" on a new card jumps further out and raises ease', () => {
    const next = scheduleNext(initialReviewState(NOW), 'easy', NOW)
    expect(daysBetween(next.dueAt, NOW)).toBe(4)
    expect(next.ease).toBeGreaterThan(2.5)
  })

  it('"again" resets repetitions, lowers ease, and re-surfaces the card within the day', () => {
    const matured = scheduleNext(scheduleNext(initialReviewState(NOW), 'good', NOW), 'good', NOW)
    const lapsed = scheduleNext(matured, 'again', NOW)
    expect(lapsed.repetitions).toBe(0)
    expect(lapsed.ease).toBeLessThan(matured.ease)
    // Due within the same day (a short lapse interval), so it counts as "due".
    expect(daysBetween(lapsed.dueAt, NOW)).toBe(0)
  })

  it('ease never drops below the 1.3 floor', () => {
    let s = initialReviewState(NOW)
    for (let i = 0; i < 20; i++) s = scheduleNext(s, 'again', NOW)
    expect(s.ease).toBeGreaterThanOrEqual(1.3)
  })

  it('tolerates a null/partial prior state', () => {
    const next = scheduleNext(null, 'good', NOW)
    expect(next.repetitions).toBe(1)
    expect(daysBetween(next.dueAt, NOW)).toBe(1)
  })
})
