import { create } from 'zustand'
import type {
  AmbientClassification,
  SpotifyPlaybackMode,
  SpotifyStatus,
  SpotifySuggestion
} from '@shared/types/api'

type SuggestionStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

// "Auto companion" cooldown: a mood swing mid-paragraph shouldn't yank the
// soundtrack. Only re-suggest when the mood actually changed AND this much
// time has passed since the last auto suggestion.
const AUTO_COOLDOWN_MS = 20_000
let suggestionRequestId = 0

interface SpotifyState {
  status: SpotifyStatus | null
  load: () => Promise<void>
  setClientId: (clientId: string) => Promise<void>
  connect: () => Promise<{ ok: boolean; error?: string }>
  disconnect: () => Promise<void>
  setPlaybackMode: (mode: SpotifyPlaybackMode) => Promise<void>
  setGenrePreferences: (genres: string[]) => Promise<void>

  suggestion: SpotifySuggestion | null
  suggestionStatus: SuggestionStatus
  lastAutoMood: string | null
  lastAutoAt: number
  requesting: boolean
  requestSuggestion: (classification: AmbientClassification) => Promise<SpotifySuggestion | null>
  maybeAutoSuggest: (classification: AmbientClassification) => Promise<void>
  openSuggestion: (suggestion?: SpotifySuggestion | null) => Promise<void>
  clearSuggestion: () => void
}

export const useSpotifyStore = create<SpotifyState>((set, get) => ({
  status: null,

  load: async () => {
    const status = await window.fuzzy.spotify.getStatus()
    set({ status })
  },

  setClientId: async (clientId) => {
    const status = await window.fuzzy.spotify.setClientId(clientId)
    set({ status })
  },

  connect: async () => {
    const result = await window.fuzzy.spotify.connect()
    set({ status: result.status })
    return result.ok ? { ok: true } : { ok: false, error: result.error }
  },

  disconnect: async () => {
    suggestionRequestId += 1
    const status = await window.fuzzy.spotify.disconnect()
    set({ status, suggestion: null, suggestionStatus: 'idle', requesting: false })
  },

  setPlaybackMode: async (mode) => {
    const status = await window.fuzzy.spotify.setPlaybackMode(mode)
    set({ status })
  },

  setGenrePreferences: async (genres) => {
    const status = await window.fuzzy.spotify.setGenrePreferences(genres)
    set({ status })
  },

  suggestion: null,
  suggestionStatus: 'idle',
  lastAutoMood: null,
  lastAutoAt: 0,
  requesting: false,

  requestSuggestion: async (classification) => {
    const requestId = ++suggestionRequestId
    set({
      requesting: true,
      suggestionStatus: 'loading',
      lastAutoMood: classification.mood,
      lastAutoAt: Date.now()
    })
    try {
      const suggestion = await window.fuzzy.spotify.suggestForMood(classification)
      if (requestId === suggestionRequestId) {
        set({
          suggestion,
          suggestionStatus: suggestion ? 'ready' : 'empty'
        })
      }
      return suggestion
    } catch {
      if (requestId === suggestionRequestId) set({ suggestionStatus: 'error' })
      return null
    } finally {
      if (requestId === suggestionRequestId) set({ requesting: false })
    }
  },

  // Called on every classification update while playback mode is "auto".
  // Only fires when the mood changed AND the cooldown has elapsed, so the
  // soundtrack follows the book like a film score, not a jittery auto-DJ.
  maybeAutoSuggest: async (classification) => {
    const { status, lastAutoMood, lastAutoAt } = get()
    if (!status?.connected || status.playbackMode !== 'auto') return
    if (classification.mood === lastAutoMood) return
    if (Date.now() - lastAutoAt < AUTO_COOLDOWN_MS) return
    await get().requestSuggestion(classification)
  },

  openSuggestion: async (suggestionToOpen) => {
    const suggestion = suggestionToOpen ?? get().suggestion
    if (!suggestion) return
    await window.fuzzy.spotify.openSuggestion(suggestion)
  },

  clearSuggestion: () => {
    suggestionRequestId += 1
    set({ suggestion: null, suggestionStatus: 'idle', requesting: false })
  }
}))
