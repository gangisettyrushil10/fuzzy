import type { FocusSessionRecord, ReadingStats } from '@shared/types/database'

// Aggregate reading stats from focus sessions. Pure: takes `nowMs` so it's
// unit-testable without the clock. Days are computed in the local timezone.

function localDayKey(iso: string, nowOffsetMin: number): string {
  // Shift by the local offset, then take the UTC date — gives the local day.
  const t = new Date(iso).getTime() - nowOffsetMin * 60_000
  return new Date(t).toISOString().slice(0, 10)
}

export function computeStats(
  sessions: FocusSessionRecord[],
  nowMs: number,
  tzOffsetMin: number
): ReadingStats {
  const todayKey = new Date(nowMs - tzOffsetMin * 60_000).toISOString().slice(0, 10)

  let totalSeconds = 0
  let totalWords = 0
  const minutesByDay = new Map<string, number>()

  for (const s of sessions) {
    totalSeconds += s.elapsedSeconds
    totalWords += s.wordsRead
    const day = localDayKey(s.startedAt, tzOffsetMin)
    minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + s.elapsedSeconds / 60)
  }

  const todayMinutes = Math.round(minutesByDay.get(todayKey) ?? 0)

  // Streak: consecutive days (ending today or yesterday) with any reading.
  let streakDays = 0
  const dayMs = 86_400_000
  // Allow the streak to be "alive" if you read today OR yesterday.
  let cursor = minutesByDay.has(todayKey) ? nowMs : nowMs - dayMs
  for (;;) {
    const key = new Date(cursor - tzOffsetMin * 60_000).toISOString().slice(0, 10)
    if ((minutesByDay.get(key) ?? 0) > 0) {
      streakDays++
      cursor -= dayMs
    } else {
      break
    }
  }

  const last7Days: ReadingStats['last7Days'] = []
  for (let i = 6; i >= 0; i--) {
    const key = new Date(nowMs - i * dayMs - tzOffsetMin * 60_000).toISOString().slice(0, 10)
    last7Days.push({ date: key, minutes: Math.round(minutesByDay.get(key) ?? 0) })
  }

  const totalMinutes = Math.round(totalSeconds / 60)
  const avgWpm = totalSeconds > 0 ? Math.round(totalWords / (totalSeconds / 60)) : 0

  return {
    todayMinutes,
    streakDays,
    totalMinutes,
    totalWords,
    avgWpm,
    sessionCount: sessions.length,
    last7Days
  }
}
