import { useEffect, useRef, useState } from 'react'
import { useFocusSessionStore } from '../../state/focusSessionStore'
import { Button } from '../ui'

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Floating focus-session HUD: live timer, words read, goal progress, and an
// idle nudge. Mounted once in AppShell; renders only while a session is active.
// Owns the per-second tick + the ~15s heartbeat persist.
export function FocusSessionHud(): React.JSX.Element | null {
  const active = useFocusSessionStore((s) => s.active)
  const goalType = useFocusSessionStore((s) => s.goalType)
  const goalTargetMinutes = useFocusSessionStore((s) => s.goalTargetMinutes)
  const end = useFocusSessionStore((s) => s.end)
  const heartbeat = useFocusSessionStore((s) => s.heartbeat)

  const [, setTick] = useState(0)
  const [idle, setIdle] = useState(false)
  const lastActivity = useRef(Date.now())

  useEffect(() => {
    if (!active) return
    const onActivity = (): void => {
      lastActivity.current = Date.now()
      setIdle(false)
    }
    const events = ['mousemove', 'keydown', 'scroll', 'wheel', 'click'] as const
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))

    let seconds = 0
    const interval = window.setInterval(() => {
      seconds += 1
      setTick((t) => t + 1)
      if (seconds % 15 === 0) void heartbeat()
      if (Date.now() - lastActivity.current > 60_000) setIdle(true)
    }, 1000)

    return () => {
      window.clearInterval(interval)
      events.forEach((e) => window.removeEventListener(e, onActivity))
    }
  }, [active, heartbeat])

  if (!active) return null

  const elapsed = Math.floor((Date.now() - active.startedAtMs) / 1000)
  const goalSeconds = goalType === 'time' ? goalTargetMinutes * 60 : 0
  const pct = goalSeconds > 0 ? Math.min(100, (elapsed / goalSeconds) * 100) : 0

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-fz-border bg-fz-elevated/95 px-3 py-1.5 shadow-fz-pop backdrop-blur">
        <span className="flex items-center gap-1.5 text-fz-ui font-medium text-fz-fg">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fz-success" />
          Focus
        </span>
        <span className="tabular-nums text-fz-ui text-fz-fg-muted">{fmt(elapsed)}</span>
        {goalSeconds > 0 && (
          <span className="h-1 w-16 overflow-hidden rounded-full bg-fz-border">
            <span className="block h-full rounded-full bg-fz-accent-2" style={{ width: `${pct}%` }} />
          </span>
        )}
        <span className="text-fz-micro tabular-nums text-fz-fg-subtle">
          {active.wordsRead.toLocaleString()} words
        </span>
        {idle && <span className="text-fz-micro text-fz-warning">Still reading?</span>}
        <Button size="sm" variant="ghost" onClick={() => void end()}>
          End
        </Button>
      </div>
    </div>
  )
}
