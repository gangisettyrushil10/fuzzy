// Lazy singleton over the bundled common-words asset. The list is inlined at
// build time via Vite's `?raw` import (no fetch), parsed into a Set on first
// use. A word being "common" suppresses the complex-word flag even if it's long
// or multi-syllable (e.g. "because", "important").
import commonWordsRaw from '../assets/data/common-words.txt?raw'

let cached: Set<string> | null = null

function load(): Set<string> {
  if (!cached) {
    cached = new Set(
      commonWordsRaw
        .split(/\r?\n/)
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean)
    )
  }
  return cached
}

export function isCommonWord(word: string): boolean {
  return load().has(word.toLowerCase())
}
