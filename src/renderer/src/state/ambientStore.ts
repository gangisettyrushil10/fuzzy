import { create } from 'zustand'
import { hardestSentence } from '../lib/sentences'
import { isCommonWord } from '../lib/frequencyList'
import { previewAmbientClassification } from '../lib/ambientPreview'
import { MoodlightTimeline, type MoodlightTimelineSource } from '../lib/moodlightTimeline'
import type { AmbientClassification } from '@shared/types/api'

// Ambient auto-explain: when enabled, the hardest sentence on each page you
// arrive at gets a quiet, streamed explanation. Off by default. Cost is bounded
// — at most one call per (document, page) per session, and only when a sentence
// is genuinely hard. Toggle persists in localStorage (no shared-prefs churn).

const KEY = 'fuzzy.ambientExplain'
const FEELING_KEY = 'fuzzy.feelingAurora'
const MOODLIGHT_PREFERENCES_KEY = 'fuzzy.moodlightPreferences.v1'
const CLASSIFICATION_CACHE_LIMIT = 64

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

export interface MoodlightPreferences {
  intensity: number
  motion: number
  responsiveness: number
}

const DEFAULT_MOODLIGHT_PREFERENCES: MoodlightPreferences = {
  intensity: 0.72,
  motion: 0.58,
  responsiveness: 0.68
}

function clampPreference(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback
}

function loadMoodlightPreferences(): MoodlightPreferences {
  try {
    const saved = JSON.parse(
      localStorage.getItem(MOODLIGHT_PREFERENCES_KEY) ?? '{}'
    ) as Partial<MoodlightPreferences>
    return {
      intensity: clampPreference(saved.intensity, DEFAULT_MOODLIGHT_PREFERENCES.intensity),
      motion: clampPreference(saved.motion, DEFAULT_MOODLIGHT_PREFERENCES.motion),
      responsiveness: clampPreference(
        saved.responsiveness,
        DEFAULT_MOODLIGHT_PREFERENCES.responsiveness
      )
    }
  } catch {
    return { ...DEFAULT_MOODLIGHT_PREFERENCES }
  }
}

function saveMoodlightPreferences(preferences: MoodlightPreferences): void {
  try {
    localStorage.setItem(MOODLIGHT_PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    /* keep the in-session settings */
  }
}

function clearClassificationCommitTimer(): void {
  if (classificationCommitTimer !== null) {
    window.clearTimeout(classificationCommitTimer)
    classificationCommitTimer = null
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
  moodlightPreferences: MoodlightPreferences
  setFeelingEnabled: (enabled: boolean) => void
  setMoodlightPreference: (key: keyof MoodlightPreferences, value: number) => void

  // --- Shared classification ---
  classification: AmbientClassification | null
  classificationKey: string | null
  previewForPage: (documentId: string, pageNumber: number, text: string) => void
  classifyForPage: (
    documentId: string,
    pageNumber: number,
    text: string
  ) => Promise<AmbientClassification | null>
  live: AmbientLiveState
  setLive: (documentId: string, pageNumber: number, progress: number, velocity?: number) => void
}

// Pages already auto-explained this session (cost guard).
const done = new Set<string>()
// Pages already classified this session, keyed by document/page/excerpt hash.
const classificationCache = new Map<string, AmbientClassification>()
const classificationCacheOrder: string[] = []
const classificationRequests = new Map<string, Promise<AmbientClassification | null>>()
const moodlightTimeline = new MoodlightTimeline()

function rememberClassification(cacheKey: string, classification: AmbientClassification): void {
  if (!classificationCache.has(cacheKey)) {
    classificationCacheOrder.push(cacheKey)
  }
  classificationCache.set(cacheKey, classification)

  while (classificationCacheOrder.length > CLASSIFICATION_CACHE_LIMIT) {
    const oldest = classificationCacheOrder.shift()
    if (oldest) classificationCache.delete(oldest)
  }
}

export const useAmbientStore = create<AmbientState>((set, get) => {
  const commitClassification = (
    classification: AmbientClassification,
    cacheKey: string,
    status: FeelingStatus,
    source: MoodlightTimelineSource,
    forceImmediate = false
  ): void => {
    clearClassificationCommitTimer()
    const current = forceImmediate ? null : get().classification
    const decision = moodlightTimeline.plan(current, classification, source)

    const apply = (): void => {
      classificationCommitTimer = null
      if (!get().feelingEnabled || get().classificationKey !== cacheKey) return
      moodlightTimeline.noteCommitted()
      set({ classification, feelingStatus: status })
    }

    const responsiveness = get().moodlightPreferences.responsiveness
    const adjustedDelay = Math.round(decision.delayMs * (1.32 - responsiveness * 0.62))

    if (adjustedDelay <= 0) {
      apply()
      return
    }

    classificationCommitTimer = window.setTimeout(apply, adjustedDelay)
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
    moodlightPreferences: loadMoodlightPreferences(),
    setFeelingEnabled: (enabled) => {
      try {
        localStorage.setItem(FEELING_KEY, enabled ? '1' : '0')
      } catch {
        /* ignore */
      }
      set({ feelingEnabled: enabled })
      if (!enabled) {
        clearClassificationCommitTimer()
        moodlightTimeline.reset()
        set({ classification: null, classificationKey: null, feelingStatus: 'idle' })
      }
    },
    setMoodlightPreference: (key, value) => {
      const preferences = {
        ...get().moodlightPreferences,
        [key]: clampPreference(value, get().moodlightPreferences[key])
      }
      saveMoodlightPreferences(preferences)
      set({ moodlightPreferences: preferences })
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
      if (changedPage) {
        clearClassificationCommitTimer()
        moodlightTimeline.reset()
      }
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
        const forceImmediate = get().classificationKey === null
        set({ classificationKey: cacheKey, feelingStatus: 'ready' })
        commitClassification(cached, cacheKey, 'ready', 'cached', forceImmediate)
        return
      }

      const preview = previewAmbientClassification(text)
      const forceImmediate = get().classificationKey === null
      set({
        classificationKey: cacheKey,
        feelingStatus: 'classifying'
      })
      commitClassification(preview, cacheKey, 'classifying', 'preview', forceImmediate)
    },

    classifyForPage: async (documentId, pageNumber, text) => {
      const { feelingEnabled } = get()
      if (!feelingEnabled) return null
      if (!text.trim()) return null

      const cacheKey = excerptCacheKey(documentId, pageNumber, text)
      const cached = classificationCache.get(cacheKey)
      if (cached) {
        const forceImmediate = get().classificationKey === null
        set({ classificationKey: cacheKey, feelingStatus: 'ready' })
        commitClassification(cached, cacheKey, 'ready', 'cached', forceImmediate)
        return cached
      }

      if (get().classificationKey !== cacheKey) {
        const forceImmediate = get().classificationKey === null
        set({ classificationKey: cacheKey, feelingStatus: 'classifying' })
        commitClassification(
          previewAmbientClassification(text),
          cacheKey,
          'classifying',
          'preview',
          forceImmediate
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
        if (!get().feelingEnabled) return null
        if (!result) {
          if (get().classificationKey === cacheKey) {
            set({ feelingStatus: 'error' })
          }
          return null
        }
        rememberClassification(cacheKey, result)
        if (get().classificationKey === cacheKey) {
          set({ feelingStatus: 'ready' })
          commitClassification(result, cacheKey, 'ready', 'rich')
        }
        return result
      } catch {
        classificationRequests.delete(cacheKey)
        if (get().classificationKey === cacheKey) {
          set({ feelingStatus: 'error' })
        }
        return null
      }
    }
  }
})
