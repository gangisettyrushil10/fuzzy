import { create } from 'zustand'
import { hardestSentence } from '../lib/sentences'
import { isCommonWord } from '../lib/frequencyList'

// Ambient auto-explain: when enabled, the hardest sentence on each page you
// arrive at gets a quiet, streamed explanation. Off by default. Cost is bounded
// — at most one call per (document, page) per session, and only when a sentence
// is genuinely hard. Toggle persists in localStorage (no shared-prefs churn).

const KEY = 'fuzzy.ambientExplain'
function loadPref(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

interface AmbientTarget {
  documentId: string
  pageNumber: number
  sentence: string
}

type Status = 'idle' | 'loading' | 'done' | 'error'

interface AmbientState {
  enabled: boolean
  target: AmbientTarget | null
  status: Status
  explanation: string | null
  setEnabled: (enabled: boolean) => void
  runForPage: (documentId: string, pageNumber: number, text: string) => Promise<void>
  dismiss: () => void
}

// Pages already auto-explained this session (cost guard).
const done = new Set<string>()

export const useAmbientStore = create<AmbientState>((set, get) => ({
  enabled: loadPref(),
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

  dismiss: () => set({ target: null, status: 'idle', explanation: null })
}))
