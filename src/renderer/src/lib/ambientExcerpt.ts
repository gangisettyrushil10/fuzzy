function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function paragraphsFromText(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length >= 28)
}

function bucketIndex(count: number, progress: number): number {
  if (count <= 1) return 0
  return Math.max(0, Math.min(count - 1, Math.round(clamp01(progress) * (count - 1))))
}

export function excerptForProgress(text: string, progress: number, targetChars = 900): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return ''

  const paragraphs = paragraphsFromText(text)
  if (paragraphs.length >= 2) {
    const center = bucketIndex(paragraphs.length, progress)
    let result = paragraphs[center] ?? ''
    let left = center - 1
    let right = center + 1

    while (result.length < targetChars && (left >= 0 || right < paragraphs.length)) {
      const takeLeft =
        left >= 0 &&
        (right >= paragraphs.length || Math.abs(center - left) <= Math.abs(right - center))

      if (takeLeft) {
        result = `${paragraphs[left]} ${result}`.trim()
        left -= 1
      } else if (right < paragraphs.length) {
        result = `${result} ${paragraphs[right]}`.trim()
        right += 1
      }
    }

    return result.slice(0, targetChars)
  }

  if (clean.length <= targetChars) return clean

  const span = Math.max(targetChars, Math.floor(clean.length * 0.34))
  const maxStart = Math.max(0, clean.length - span)
  const bucket = bucketIndex(7, progress)
  const normalized = bucket / 6
  const start = Math.round(maxStart * normalized)
  return clean.slice(start, start + span).trim()
}
