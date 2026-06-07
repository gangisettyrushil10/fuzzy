// Pure math behind the progressive "typewriter" reveal used to make mocked AI
// responses feel alive. Timer-free: the hook (useTypewriter) drives elapsed
// time via requestAnimationFrame and asks how much should be visible. Keeping
// the math here means it unit-tests without fake timers.

// How many characters of a string should be visible after `elapsedMs` at a
// rate of `cps` characters per second. cps <= 0 means "reveal instantly".
export function revealedChars(elapsedMs: number, cps: number): number {
  if (cps <= 0) return Number.MAX_SAFE_INTEGER
  if (elapsedMs <= 0) return 0
  return Math.floor((elapsedMs / 1000) * cps)
}

// Convenience: the visible prefix of `text` at a point in time.
export function revealedText(text: string, elapsedMs: number, cps: number): string {
  const n = revealedChars(elapsedMs, cps)
  return n >= text.length ? text : text.slice(0, n)
}

export function isRevealComplete(elapsedMs: number, cps: number, total: number): boolean {
  return revealedChars(elapsedMs, cps) >= total
}
