import { useEffect } from 'react'
import { useFocusSessionStore } from '../../state/focusSessionStore'
import { Modal } from '../ui'

// Reading insights: today / streak / totals / avg WPM + a last-7-days bar chart.
// Computed in main from focus sessions.
export function StatsPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const stats = useFocusSessionStore((s) => s.stats)
  const loadStats = useFocusSessionStore((s) => s.loadStats)

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const maxMinutes = Math.max(1, ...(stats?.last7Days ?? []).map((d) => d.minutes))

  return (
    <Modal title="Reading insights" size="md" onClose={onClose}>
      {!stats ? (
        <p className="text-fz-ui text-fz-fg-muted">Loading…</p>
      ) : stats.sessionCount === 0 ? (
        <p className="text-fz-ui leading-relaxed text-fz-fg-muted">
          No focus sessions yet. Start one from the bottom bar to begin tracking your reading minutes,
          words, and streak.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Today" value={`${stats.todayMinutes}m`} />
            <Stat label="Streak" value={`${stats.streakDays}d`} accent />
            <Stat label="Avg speed" value={`${stats.avgWpm} wpm`} />
            <Stat label="Total" value={`${stats.totalMinutes}m`} />
          </div>

          <div>
            <h3 className="mb-2 text-fz-label font-semibold uppercase tracking-wider text-fz-fg-subtle">
              Last 7 days
            </h3>
            <div className="flex items-end gap-2">
              {stats.last7Days.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-24 w-full items-end">
                    <div
                      className="w-full rounded-t bg-fz-accent-2/70"
                      style={{ height: `${(d.minutes / maxMinutes) * 100}%` }}
                      title={`${d.minutes} min`}
                    />
                  </div>
                  <span className="text-fz-micro text-fz-fg-subtle">
                    {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, {
                      weekday: 'narrow'
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-fz-micro text-fz-fg-subtle">
            {stats.totalWords.toLocaleString()} words read across {stats.sessionCount} session
            {stats.sessionCount === 1 ? '' : 's'}.
          </p>
        </div>
      )}
    </Modal>
  )
}

function Stat({
  label,
  value,
  accent
}: {
  label: string
  value: string
  accent?: boolean
}): React.JSX.Element {
  return (
    <div className="rounded-fz border border-fz-border bg-fz-bg/50 p-3">
      <div className={`text-fz-title font-semibold ${accent ? 'text-fz-accent' : 'text-fz-fg'}`}>
        {value}
      </div>
      <div className="text-fz-micro uppercase tracking-wider text-fz-fg-subtle">{label}</div>
    </div>
  )
}
