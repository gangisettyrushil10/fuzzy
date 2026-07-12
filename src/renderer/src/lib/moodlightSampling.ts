function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  return Math.max(0, Math.min(1, value))
}

export function moodlightExcerptChars(responsiveness: number): number {
  return Math.round(760 - clamp01(responsiveness) * 320)
}

export function moodlightClassificationDelay(responsiveness: number, immediate = false): number {
  const response = clamp01(responsiveness)
  return Math.round(immediate ? 320 - response * 140 : 980 - response * 560)
}
