import { create } from 'zustand'
import { hardestSentence } from '../lib/sentences'
import { isCommonWord } from '../lib/frequencyList'
import type { AmbientClassification } from '@shared/types/api'

// Ambient auto-explain: when enabled, the hardest sentence on each page you
// arrive at gets a quiet, streamed explanation. Off by default. Cost is bounded
// — at most one call per (document, page) per session, and only when a sentence
// is genuinely hard. Toggle persists in localStorage (no shared-prefs churn).

const KEY = 'fuzzy.ambientExplain'
const FEELING_KEY = 'fuzzy.feelingAurora'

function excerptCacheKey(documentId: string, pageNumber: number, text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  }
  return `${documentId}:${pageNumber}:${hash.toString(36)}`
}

function loadBoolPref(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

interface AmbientTarget {
  documentId: string
  pageNumber: number
  sentence: string
}

interface AmbientLiveState {
  documentId: string
  pageNumber: number
  progress: number
  velocity: number
  phase: number
}

type Status = 'idle' | 'loading' | 'done' | 'error'

interface AmbientState {
  // --- existing auto-explain ---
  enabled: boolean
  target: AmbientTarget | null
  status: Status
  explanation: string | null
  setEnabled: (enabled: boolean) => void
  runForPage: (documentId: string, pageNumber: number, text: string) => Promise<void>
  dismiss: () => void

  // --- Feeling Aurora ---
  feelingEnabled: boolean
  setFeelingEnabled: (enabled: boolean) => void

  // --- Shared classification ---
  classification: AmbientClassification | null
  classifyForPage: (documentId: string, pageNumber: number, text: string) => Promise<void>
  live: AmbientLiveState
  setLive: (documentId: string, pageNumber: number, progress: number, velocity?: number) => void
}

// Pages already auto-explained this session (cost guard).
const done = new Set<string>()
// Pages already classified this session.
const classified = new Set<string>()

export const useAmbientStore = create<AmbientState>((set, get) => ({
  // --- existing auto-explain ---
  enabled: loadBoolPref(KEY),
  target: null,
  status: 'idle',
  explanation: null,

  setEnabled: (enabled) => {
    try {
      localStorage.setItem(KEY, enabled ? '1' : '0')
    } catch {
      /* ignore */
    }
    set({ enabled })
    if (!enabled) set({ target: null, status: 'idle', explanation: null })
  },

  runForPage: async (documentId, pageNumber, text) => {
    if (!get().enabled || !text.trim()) return
    const key = `${documentId}:${pageNumber}`
    if (done.has(key)) return
    done.add(key)

    const hard = hardestSentence(text, isCommonWord)
    if (!hard) return

    set({
      target: { documentId, pageNumber, sentence: hard.sentence },
      status: 'loading',
      explanation: null
    })
    try {
      const r = await window.fuzzy.ai.runAction({
        documentId,
        pageNumber,
        action: 'explain',
        selectedText: hard.sentence,
        contextText: text
      })
      // Drop if the user moved on / dismissed / toggled off.
      const t = get().target
      if (!t || t.documentId !== documentId || t.pageNumber !== pageNumber) return
      set({ explanation: r.outputText, status: 'done' })
    } catch {
      set({ status: 'error' })
    }
  },

  dismiss: () => set({ target: null, status: 'idle', explanation: null }),

  // --- Feeling Aurora ---
  feelingEnabled: loadBoolPref(FEELING_KEY),
  setFeelingEnabled: (enabled) => {
    try {
      localStorage.setItem(FEELING_KEY, enabled ? '1' : '0')
    } catch {
      /* ignore */
    }
    set({ feelingEnabled: enabled })
    if (!enabled) set({ classification: null })
  },

  // --- Shared classification ---
  classification: null,
  live: {
    documentId: '',
    pageNumber: 0,
    progress: 0.5,
    velocity: 0,
    phase: 0
  },
  setLive: (documentId, pageNumber, progress, velocity = 0) => {
    const clamped = Math.max(0, Math.min(1, progress))
    const phase = (((pageNumber * 0.173 + clamped * 0.81) % 1) + 1) % 1
    set({
      live: {
        documentId,
        pageNumber,
        progress: clamped,
        velocity: Math.max(-1, Math.min(1, velocity)),
        phase
      }
    })
  },

  classifyForPage: async (documentId, pageNumber, text) => {
    const { feelingEnabled } = get()
    if (!feelingEnabled) return
    if (!text.trim()) return

    const cacheKey = excerptCacheKey(documentId, pageNumber, text)
    if (classified.has(cacheKey)) return
    classified.add(cacheKey)

    try {
      const result = await window.fuzzy.ambient.classify(documentId, pageNumber, text)
      if (!get().feelingEnabled) return
      if (result) set({ classification: result })
    } catch {
      // Silent — no error UI for ambient features
    }
  }
}))
