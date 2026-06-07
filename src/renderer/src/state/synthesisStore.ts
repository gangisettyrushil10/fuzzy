import { create } from 'zustand'
import type { SynthesisMode, SynthesisResult } from '@shared/types/database'
import { useThesisStore } from './thesisStore'
import { useDocumentStore } from './documentStore'

// Cross-document synthesis: turns the current thesis into a structured, cited
// argument (mode 'support') or its strongest rebuttal (mode 'counter').
// Retrieval + (mock or real) organization happen in main; here we just drive a
// short staged reveal for liveness.

type SynthStatus = 'idle' | 'analyzing' | 'done' | 'error'

interface SynthesisState {
  status: SynthStatus
  mode: SynthesisMode
  result: SynthesisResult | null
  error: string | null
  generate: (mode: SynthesisMode) => Promise<void>
  reset: () => void
}

const MIN_ANALYZE_MS = 600
let runCounter = 0
let activeRun = 0
const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export const useSynthesisStore = create<SynthesisState>((set) => ({
  status: 'idle',
  mode: 'support',
  result: null,
  error: null,

  generate: async (mode) => {
    const { thesis, scope } = useThesisStore.getState()
    if (!thesis.trim()) return
    const token = ++runCounter
    activeRun = token
    set({ status: 'analyzing', mode, result: null, error: null })
    const activeDocumentId = useDocumentStore.getState().activeDocumentId
    try {
      const [result] = await Promise.all([
        window.fuzzy.synthesis.generate({ thesis, scope, activeDocumentId, mode }),
        delay(MIN_ANALYZE_MS)
      ])
      if (activeRun !== token) return
      set({ status: 'done', result })
    } catch (err) {
      if (activeRun !== token) return
      set({ status: 'error', error: err instanceof Error ? err.message : 'Synthesis failed' })
    }
  },

  reset: () => set({ status: 'idle', result: null, error: null })
}))
