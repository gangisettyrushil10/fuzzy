import { useEffect } from 'react'
import { usePacerStore } from '../state/pacerStore'

// Drives the pacer's word-by-word advance via requestAnimationFrame. Mounted
// ONCE in AppShell. Reads live state each frame (via getState) so a single rAF
// loop spans every word without restarting per position; it only re-arms when
// the play/pause status flips. rAF naturally pauses when the window is hidden,
// so a backgrounded app doesn't race ahead.
export function usePacer(): void {
  const status = usePacerStore((s) => s.status)

  useEffect(() => {
    if (status !== 'playing') return
    let raf = 0
    let due = 0
    let armed = false

    const tick = (now: number): void => {
      const store = usePacerStore.getState()
      if (store.status !== 'playing') return
      if (!armed) {
        due = now + store.currentDelayMs()
        armed = true
      }
      if (now >= due) {
        store.advance()
        // advance() may have parked us at the end (status -> paused).
        const after = usePacerStore.getState()
        if (after.status !== 'playing') return
        due = now + after.currentDelayMs()
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [status])
}
