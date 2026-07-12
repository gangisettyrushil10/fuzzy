import { create } from 'zustand'
import { hardestSentence } from '../lib/sentences'
import { isCommonWord } from '../lib/frequencyList'
import { previewAmbientClassification } from '../lib/ambientPreview'
import type { AmbientClassification } from '@shared/types/api'

// Ambient auto-explain: when enabled, the hardest sentence on each page you
// arrive at gets a quiet, streamed explanation. Off by default. Cost is bounded
// — at most one call per (document, page) per session, and only when a sentence
// is genuinely hard. Toggle persists in localStorage (no shared-prefs churn).

const KEY = 'fuzzy.ambientExplain'
const FEELING_KEY = 'fuzzy.feelingAurora'
const PREVIEW_SETTLE_MS = 520
const CACHED_SETTLE_MS = 260
const RICH_SETTLE_MS = 900

let classificationCommitTimer: number | null = null

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

function clearClassificationCommitTimer(): void {
  if (classificationCommitTimer !== null) {
    window.clearTimeout(classificationCommitTimer)
    classificationCommitTimer = null
  }
}

function visualClassificationKey(classification: AmbientClassification | null): string {
  if (!classification) return 'neutral'
  return [
    classification.mood,
    classification.secondaryMood ?? 'none',
    classification.motion,
    classification.sceneTags[0] ?? 'none',
    classification.paletteHints.slice(0, 3).join(',')
  ].join(':')
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
type FeelingStatus = 'idle' | 'classifying' | 'ready' | 'error'

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
  feelingStatus: FeelingStatus
  setFeelingEnabled: (enabled: boolean) => void

  // --- Shared classification ---
  classification: AmbientClassification | null
  classificationKey: string | null
  previewForPage: (documentId: string, pageNumber: number, text: string) => void
  classifyForPage: (documentId: string, pageNumber: number, text: string) => Promise<void>
  live: AmbientLiveState
  setLive: (documentId: string, pageNumber: number, progress: number, velocity?: number) => void
}

// Pages already auto-explained this session (cost guard).
const done = new Set<string>()
// Pages already classified this session, keyed by document/page/excerpt hash.
const classificationCache = new Map<string, AmbientClassification>()
const classificationRequests = new Map<string, Promise<AmbientClassification | null>>()

export const useAmbientStore = create<AmbientState>((set, get) => {
  const commitClassification = (
    classification: AmbientClassification,
    cacheKey: string,
    status: FeelingStatus,
    delayMs: number
  ): void => {
    clearClassificationCommitTimer()

    const current = get().classification
    const shouldApplyNow =
      !current || visualClassificationKey(current) === visualClassificationKey(classification)

    const apply = (): void => {
      classificationCommitTimer = null
      if (!get().feelingEnabled || get().classificationKey !== cacheKey) return
      set({ classification, feelingStatus: status })
    }

    if (shouldApplyNow || delayMs <= 0) {
      apply()
      return
    }

    classificationCommitTimer = window.setTimeout(apply, delayMs)
  }

  return {
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
    feelingStatus: 'idle',
    setFeelingEnabled: (enabled) => {
      try {
        localStorage.setItem(FEELING_KEY, enabled ? '1' : '0')
      } catch {
        /* ignore */
      }
      set({ feelingEnabled: enabled })
      if (!enabled) {
        clearClassificationCommitTimer()
        set({ classification: null, classificationKey: null, feelingStatus: 'idle' })
      }
    },

    // --- Shared classification ---
    classification: null,
    classificationKey: null,
    live: {
      documentId: '',
      pageNumber: 0,
      progress: 0.5,
      velocity: 0,
      phase: 0
    },
    setLive: (documentId, pageNumber, progress, velocity = 0) => {
      const clamped = Math.max(0, Math.min(1, progress))
      const previous = get().live
      const changedPage = previous.documentId !== documentId || previous.pageNumber !== pageNumber
      const rawVelocity = Math.max(-1, Math.min(1, velocity))
      const smoothProgress = changedPage
        ? clamped
        : previous.progress + (clamped - previous.progress) * 0.42
      const smoothVelocity = changedPage ? 0 : previous.velocity * 0.72 + rawVelocity * 0.28
      const phase = (((pageNumber * 0.173 + smoothProgress * 0.81) % 1) + 1) % 1
      set({
        live: {
          documentId,
          pageNumber,
          progress: smoothProgress,
          velocity: Math.max(-1, Math.min(1, smoothVelocity)),
          phase
        },
        ...(changedPage ? { classificationKey: null, feelingStatus: 'idle' as const } : {})
      })
    },

    previewForPage: (documentId, pageNumber, text) => {
      if (!get().feelingEnabled) return
      if (!text.trim()) return

      const cacheKey = excerptCacheKey(documentId, pageNumber, text)
      const cached = classificationCache.get(cacheKey)
      if (cached) {
        set({ classificationKey: cacheKey, feelingStatus: 'ready' })
        commitClassification(cached, cacheKey, 'ready', CACHED_SETTLE_MS)
        return
      }

      const preview = previewAmbientClassification(text)
      set({
        classificationKey: cacheKey,
        feelingStatus: 'classifying'
      })
      commitClassification(preview, cacheKey, 'classifying', PREVIEW_SETTLE_MS)
    },

    classifyForPage: async (documentId, pageNumber, text) => {
      const { feelingEnabled } = get()
      if (!feelingEnabled) return
      if (!text.trim()) return

      const cacheKey = excerptCacheKey(documentId, pageNumber, text)
      const cached = classificationCache.get(cacheKey)
      if (cached) {
        set({ classificationKey: cacheKey, feelingStatus: 'ready' })
        commitClassification(cached, cacheKey, 'ready', CACHED_SETTLE_MS)
        return
      }

      if (get().classificationKey !== cacheKey) {
        set({ classificationKey: cacheKey, feelingStatus: 'classifying' })
        commitClassification(
          previewAmbientClassification(text),
          cacheKey,
          'classifying',
          PREVIEW_SETTLE_MS
        )
      }

      try {
        const existingRequest = classificationRequests.get(cacheKey)
        const request =
          existingRequest ?? window.fuzzy.ambient.classify(documentId, pageNumber, text)
        if (!existingRequest) {
          classificationRequests.set(cacheKey, request)
        }
        const result = await request
        classificationRequests.delete(cacheKey)
        if (!get().feelingEnabled) return
        if (!result) {
          if (get().classificationKey === cacheKey) {
            set({ feelingStatus: 'error' })
          }
          return
        }
        classificationCache.set(cacheKey, result)
        if (get().classificationKey === cacheKey) {
          set({ feelingStatus: 'ready' })
          commitClassification(result, cacheKey, 'ready', RICH_SETTLE_MS)
        }
      } catch {
        classificationRequests.delete(cacheKey)
        if (get().classificationKey === cacheKey) {
          set({ feelingStatus: 'error' })
        }
      }
    }
  }
})
