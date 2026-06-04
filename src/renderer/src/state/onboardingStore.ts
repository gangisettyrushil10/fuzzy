import { create } from 'zustand'

const STORAGE_KEY = 'fuzzy.onboarding.complete'
const STEP_KEY = 'fuzzy.onboarding.step'

interface OnboardingState {
  complete: boolean
  step: number
  visible: boolean
  load: () => void
  dismiss: () => void
  advance: () => void
  show: () => void
}

function readBool(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function readStep(): number {
  try {
    const n = Number(localStorage.getItem(STEP_KEY))
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  complete: false,
  step: 0,
  visible: false,

  load: () => {
    const complete = readBool(STORAGE_KEY)
    set({ complete, step: readStep(), visible: !complete })
  },

  dismiss: () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    set({ complete: true, visible: false })
  },

  advance: () => {
    const next = get().step + 1
    try {
      localStorage.setItem(STEP_KEY, String(next))
    } catch {
      /* ignore */
    }
    set({ step: next })
    if (next >= 5) get().dismiss()
  },

  show: () => {
    if (!get().complete) set({ visible: true })
  }
}))
