import { useCallback, useEffect, useRef, useState } from 'react'
import { revealedChars } from '../lib/reveal'

// Progressive "typewriter" reveal for mocked AI text, so a single completion
// still feels alive. The math lives in lib/reveal.ts (unit-tested); this hook
// just drives elapsed time via requestAnimationFrame.
//
// Replay guard: once a given message id has fully revealed, it's remembered
// module-side and re-mounts render instantly. That stops the animation from
// re-running when an unrelated store update re-renders the panel — only a
// genuinely new id animates. Honors prefers-reduced-motion and an `enabled`
// flag (wired later to the reader "animations" preference).

const revealedIds = new Set<string>()

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

interface Options {
  id: string
  text: string
  cps?: number
  enabled?: boolean
}

interface Result {
  display: string
  isStreaming: boolean
  skip: () => void
}

export function useTypewriter({ id, text, cps = 45, enabled = true }: Options): Result {
  const instant = !enabled || cps <= 0 || prefersReducedMotion() || revealedIds.has(id)
  const [count, setCount] = useState(instant ? text.length : 0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const skippedRef = useRef(false)

  useEffect(() => {
    if (instant) {
      setCount(text.length)
      revealedIds.add(id)
      return
    }
    skippedRef.current = false
    startRef.current = null
    setCount(0)

    const tick = (now: number): void => {
      if (skippedRef.current) return
      if (startRef.current === null) startRef.current = now
      const elapsed = now - startRef.current
      const n = Math.min(text.length, revealedChars(elapsed, cps))
      setCount(n)
      if (n < text.length) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        revealedIds.add(id)
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [id, text, cps, instant])

  const skip = useCallback(() => {
    skippedRef.current = true
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    revealedIds.add(id)
    setCount(text.length)
  }, [id, text.length])

  const display = count >= text.length ? text : text.slice(0, count)
  return { display, isStreaming: count < text.length, skip }
}
