import { describe, it, expect } from 'vitest'
import { computeStats } from '../src/main/services/stats/statsService'
import type { FocusSessionRecord } from '../src/shared/types/database'

// Fixed clock in UTC so day math is deterministic (tzOffset 0).
const NOW = Date.parse('2026-06-05T12:00:00Z')
const TZ = 0

function session(startedAt: string, elapsedSeconds: number, wordsRead: number): FocusSessionRecord {
  return {
    id: Math.random().toString(36).slice(2),
    documentId: 'd1',
    startedAt,
    endedAt: startedAt,
    elapsedSeconds,
    wordsRead,
    wpm: null,
    pageStart: 1,
    pageEnd: 2,
    goalType: 'none',
    goalTarget: null,
    createdAt: startedAt
  }
}

describe('computeStats', () => {
  it('sums today, totals, and avg wpm', () => {
    const s = computeStats(
      [
        session('2026-06-05T09:00:00Z', 600, 1500), // today, 10 min
        session('2026-06-04T09:00:00Z', 1200, 3000) // yesterday, 20 min
      ],
      NOW,
      TZ
    )
    expect(s.todayMinutes).toBe(10)
    expect(s.totalMinutes).toBe(30)
    expect(s.totalWords).toBe(4500)
    expect(s.avgWpm).toBe(150) // 4500 words / 30 min
    expect(s.sessionCount).toBe(2)
    expect(s.last7Days).toHaveLength(7)
  })

  it('counts a consecutive-day streak ending today', () => {
    const s = computeStats(
      [
        session('2026-06-05T08:00:00Z', 300, 0),
        session('2026-06-04T08:00:00Z', 300, 0),
        session('2026-06-03T08:00:00Z', 300, 0)
      ],
      NOW,
      TZ
    )
    expect(s.streakDays).toBe(3)
  })

  it('breaks the streak on a gap day', () => {
    const s = computeStats(
      [
        session('2026-06-05T08:00:00Z', 300, 0),
        // gap on 06-04
        session('2026-06-03T08:00:00Z', 300, 0)
      ],
      NOW,
      TZ
    )
    expect(s.streakDays).toBe(1)
  })

  it('handles an empty history', () => {
    const s = computeStats([], NOW, TZ)
    expect(s).toMatchObject({ todayMinutes: 0, streakDays: 0, totalMinutes: 0, avgWpm: 0, sessionCount: 0 })
    expect(s.last7Days).toHaveLength(7)
  })
})
