import { create } from 'zustand'
import type {
  AmbientClassification,
  SpotifyPlaybackMode,
  SpotifyPlaybackResult,
  SpotifyPlaybackSnapshot,
  SpotifyStatus,
  SpotifySuggestion,
  SpotifySuggestionOptions
} from '@shared/types/api'

type SuggestionStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'
export type SpotifyPlaybackState = 'idle' | 'starting' | 'playing' | 'error'

const AUTO_COOLDOWN_MS = 45_000
const RECENT_TRACK_LIMIT = 8
let suggestionRequestId = 0

function sceneKey(classification: AmbientClassification): string {
  return classification.sceneTags[0]?.trim().toLowerCase() ?? ''
}

export function isMeaningfulSoundtrackShift(
  previous: AmbientClassification | null,
  next: AmbientClassification
): boolean {
  if (!previous) return true
  if (previous.mood !== next.mood) return true
  if (sceneKey(previous) !== sceneKey(next)) return true
  return Math.abs(previous.intensity - next.intensity) >= 0.3
}

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
  currentClassification: AmbientClassification | null
  recentUris: string[]
  lastAutoAt: number
  requesting: boolean
  playbackState: SpotifyPlaybackState
  playbackMessage: string | null
  undoSnapshot: SpotifyPlaybackSnapshot | null
  requestSuggestion: (
    classification: AmbientClassification,
    options?: Omit<SpotifySuggestionOptions, 'excludeUris'>
  ) => Promise<SpotifySuggestion | null>
  soundtrackPassage: (
    classification: AmbientClassification,
    options?: Omit<SpotifySuggestionOptions, 'excludeUris'>
  ) => Promise<SpotifyPlaybackResult | null>
  maybeAutoSuggest: (classification: AmbientClassification) => Promise<void>
  playSuggestion: (suggestion?: SpotifySuggestion | null) => Promise<SpotifyPlaybackResult | null>
  undoLastSwap: () => Promise<boolean>
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
    set({
      status,
      suggestion: null,
      suggestionStatus: 'idle',
      currentClassification: null,
      recentUris: [],
      requesting: false,
      playbackState: 'idle',
      playbackMessage: null,
      undoSnapshot: null
    })
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
  currentClassification: null,
  recentUris: [],
  lastAutoAt: 0,
  requesting: false,
  playbackState: 'idle',
  playbackMessage: null,
  undoSnapshot: null,

  requestSuggestion: async (classification, options) => {
    const requestId = ++suggestionRequestId
    const excludeUris = get().recentUris
    set({ requesting: true, suggestionStatus: 'loading', playbackMessage: null })
    try {
      const suggestion = await window.fuzzy.spotify.suggestForMood(classification, {
        excludeUris,
        ...(options ?? {})
      })
      if (requestId === suggestionRequestId) {
        const recentUris = suggestion?.uri
          ? [suggestion.uri, ...excludeUris.filter((uri) => uri !== suggestion.uri)].slice(
              0,
              RECENT_TRACK_LIMIT
            )
          : excludeUris
        set({
          suggestion,
          suggestionStatus: suggestion ? 'ready' : 'empty',
          recentUris
        })
      }
      return suggestion
    } catch {
      if (requestId === suggestionRequestId) {
        set({ suggestionStatus: 'error', playbackMessage: 'Spotify search failed. Try again.' })
      }
      return null
    } finally {
      if (requestId === suggestionRequestId) set({ requesting: false })
    }
  },

  playSuggestion: async (suggestionToPlay) => {
    const suggestion = suggestionToPlay ?? get().suggestion
    if (!suggestion) return null
    set({ playbackState: 'starting', playbackMessage: `Starting ${suggestion.name ?? 'track'}…` })
    try {
      const result = await window.fuzzy.spotify.playSuggestion(suggestion)
      if (result.started) {
        set({
          playbackState: 'playing',
          playbackMessage: `Playing ${suggestion.name ?? 'your soundtrack'}`,
          undoSnapshot: result.previous
        })
      } else {
        set({ playbackState: 'error', playbackMessage: result.message, undoSnapshot: null })
      }
      return result
    } catch {
      set({
        playbackState: 'error',
        playbackMessage: 'Spotify could not start this track.',
        undoSnapshot: null
      })
      return null
    }
  },

  soundtrackPassage: async (classification, options) => {
    const suggestion = await get().requestSuggestion(classification, options)
    if (!suggestion) return null
    const result = await get().playSuggestion(suggestion)
    if (result?.ok) set({ currentClassification: classification, lastAutoAt: Date.now() })
    return result
  },

  maybeAutoSuggest: async (classification) => {
    const { status, currentClassification, lastAutoAt, requesting, playbackState } = get()
    if (!status?.connected || status.playbackMode !== 'auto' || requesting) return
    if (playbackState === 'starting') return
    if (!isMeaningfulSoundtrackShift(currentClassification, classification)) return
    if (Date.now() - lastAutoAt < AUTO_COOLDOWN_MS) return
    await get().soundtrackPassage(classification)
  },

  undoLastSwap: async () => {
    const snapshot = get().undoSnapshot
    if (!snapshot) return false
    try {
      const result = await window.fuzzy.spotify.restorePlayback(snapshot)
      if (!result.ok) {
        set({ playbackState: 'error', playbackMessage: result.message ?? 'Could not undo.' })
        return false
      }
      set({
        suggestion: {
          lane: 'Restored soundtrack',
          query: '',
          querySource: 'fallback',
          trackId: snapshot.uri.split(':').pop() ?? null,
          uri: snapshot.uri,
          name: snapshot.name,
          description: null,
          imageUrl: snapshot.imageUrl,
          externalUrl: snapshot.externalUrl,
          artistName: snapshot.artistName
        },
        suggestionStatus: 'ready',
        currentClassification: null,
        playbackState: 'playing',
        playbackMessage: `Restored ${snapshot.name ?? 'previous track'}`,
        undoSnapshot: null,
        lastAutoAt: Date.now()
      })
      return true
    } catch {
      set({ playbackState: 'error', playbackMessage: 'Spotify could not restore the last track.' })
      return false
    }
  },

  openSuggestion: async (suggestionToOpen) => {
    const suggestion = suggestionToOpen ?? get().suggestion
    if (!suggestion) return
    const result = await window.fuzzy.spotify.openSuggestion(suggestion)
    if (!result.ok) {
      set({ playbackMessage: result.message ?? 'The Spotify app could not be opened.' })
    }
  },

  clearSuggestion: () => {
    suggestionRequestId += 1
    set({
      suggestion: null,
      suggestionStatus: 'idle',
      currentClassification: null,
      recentUris: [],
      requesting: false,
      playbackState: 'idle',
      playbackMessage: null,
      undoSnapshot: null
    })
  }
}))
