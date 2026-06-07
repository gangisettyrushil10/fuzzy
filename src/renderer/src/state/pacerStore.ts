import { create } from 'zustand'
import { tokenize, weightForToken, words as wordTokens, type Token } from '../lib/tokenize'
import { analyzeComplexity } from '../lib/complexity'
import { isCommonWord } from '../lib/frequencyList'
import { useReaderPrefsStore } from './readerPrefsStore'

// WPM moving-highlight pacer — TRANSPORT state only (persisted preferences like
// wpm/focusMode live in readerPrefsStore; we mirror wpm here for the rAF loop).
// usePacer drives `advance()` over time; readers render the highlight off
// `activeTokenIndex()`.
//
// Pause-to-explain: when enabled, the sweep stops on a complex word and surfaces
// a quick definition (see PacerBar), then flows on. The toggle persists in
// localStorage so it survives reloads without touching the shared prefs blob.

export type PacerStatus = 'idle' | 'playing' | 'paused'

export interface ExplainTarget {
  tokenIndex: number
  word: string
}

const EXPLAIN_KEY = 'fuzzy.pacerExplain'
function loadExplainPref(): boolean {
  try {
    return localStorage.getItem(EXPLAIN_KEY) === '1'
  } catch {
    return false
  }
}

interface PacerState {
  status: PacerStatus
  visible: boolean
  sourceKey: string | null
  words: Token[]
  // token.index values flagged complex on the current source (for pause-to-explain).
  complexIndices: Set<number>
  position: number // index into `words`; -1 = not started
  wpm: number
  // Pause-to-explain.
  explainEnabled: boolean
  explainTarget: ExplainTarget | null
  lastExplainedIndex: number

  loadSource: (sourceKey: string, text: string) => void
  show: () => void
  hide: () => void
  toggleVisible: () => void
  play: () => void
  pause: () => void
  toggle: () => void
  stop: () => void
  advance: () => void
  seek: (position: number) => void
  setWpm: (wpm: number) => void
  setExplainEnabled: (enabled: boolean) => void
  resumeFromExplain: () => void
  activeTokenIndex: () => number
  currentDelayMs: () => number
}

export const usePacerStore = create<PacerState>((set, get) => ({
  status: 'idle',
  visible: false,
  sourceKey: null,
  words: [],
  complexIndices: new Set(),
  position: -1,
  wpm: useReaderPrefsStore.getState().prefs.targetWpm,
  explainEnabled: loadExplainPref(),
  explainTarget: null,
  lastExplainedIndex: -1,

  loadSource: (sourceKey, text) => {
    if (get().sourceKey === sourceKey) return
    const tokens = tokenize(text)
    const ws = wordTokens(tokens)
    // Detect complex words for pause-to-explain. Use the reader's sensitivity,
    // but fall back to 'subtle' if highlighting is off so the pause still works.
    const sensitivity = useReaderPrefsStore.getState().prefs.complexitySensitivity
    const effective = sensitivity === 'off' ? 'subtle' : sensitivity
    const complexIndices = analyzeComplexity(tokens, effective, isCommonWord).complexIndices
    set({
      sourceKey,
      words: ws,
      complexIndices,
      position: -1,
      explainTarget: null,
      lastExplainedIndex: -1,
      status: get().visible ? 'idle' : get().status
    })
  },

  show: () => set({ visible: true, wpm: useReaderPrefsStore.getState().prefs.targetWpm }),
  hide: () => set({ visible: false, status: 'idle', position: -1, explainTarget: null }),
  toggleVisible: () => (get().visible ? get().hide() : get().show()),

  play: () => {
    const { words, position } = get()
    if (words.length === 0) return
    const start = position < 0 || position >= words.length ? 0 : position
    set({ status: 'playing', position: start, visible: true, explainTarget: null })
  },
  pause: () => set({ status: 'paused' }),
  toggle: () => (get().status === 'playing' ? get().pause() : get().play()),
  stop: () => set({ status: 'idle', position: -1, explainTarget: null, lastExplainedIndex: -1 }),

  advance: () => {
    const { position, words, complexIndices, explainEnabled, lastExplainedIndex } = get()
    const next = position + 1
    if (next >= words.length) {
      set({ status: 'paused', position: words.length - 1 })
      return
    }
    const tok = words[next]
    // Auto-pause on a complex word (once per word) when explain is enabled.
    if (explainEnabled && complexIndices.has(tok.index) && tok.index !== lastExplainedIndex) {
      set({
        position: next,
        status: 'paused',
        explainTarget: { tokenIndex: tok.index, word: tok.text },
        lastExplainedIndex: tok.index
      })
      return
    }
    set({ position: next })
  },

  seek: (position) => {
    const { words } = get()
    if (words.length === 0) return
    set({ position: Math.min(Math.max(position, 0), words.length - 1) })
  },

  setWpm: (wpm) => {
    set({ wpm })
    void useReaderPrefsStore.getState().set({ targetWpm: wpm })
  },

  setExplainEnabled: (enabled) => {
    try {
      localStorage.setItem(EXPLAIN_KEY, enabled ? '1' : '0')
    } catch {
      /* ignore */
    }
    set({ explainEnabled: enabled })
  },

  resumeFromExplain: () => {
    set({ explainTarget: null })
    get().play()
  },

  activeTokenIndex: () => {
    const { words, position } = get()
    if (position < 0 || position >= words.length) return -1
    return words[position].index
  },

  currentDelayMs: () => {
    const { words, position, wpm } = get()
    const base = 60_000 / Math.max(wpm, 1)
    const word = position >= 0 && position < words.length ? words[position] : null
    return base * (word ? weightForToken(word) : 1)
  }
}))
