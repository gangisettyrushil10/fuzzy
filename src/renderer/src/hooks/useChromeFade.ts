import { useEffect, useRef, useState } from 'react'

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'scroll', 'wheel', 'click', 'touchstart'] as const

// Hides shell chrome after idle while Moodlight is on; any activity brings it back.
export function useChromeFade(enabled: boolean, idleMs = 3000): boolean {
  const [hidden, setHidden] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) {
      setHidden(false)
      return
    }

    const arm = (): void => {
      setHidden(false)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setHidden(true), idleMs)
    }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, arm, { passive: true }))
    arm()

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, arm))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [enabled, idleMs])

  return hidden
}
