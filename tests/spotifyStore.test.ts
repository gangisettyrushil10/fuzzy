import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AmbientClassification, SpotifySuggestion } from '../src/shared/types/api'
import {
  isMeaningfulSoundtrackShift,
  useSpotifyStore
} from '../src/renderer/src/state/spotifyStore'

const calmClassification: AmbientClassification = {
  mood: 'calm',
  secondaryMood: null,
  genre: 'literary',
  type: 'fiction',
  intensity: 0.3,
  sceneTags: [],
  paletteHints: [],
  motion: 'drift'
}

function suggestion(name: string): SpotifySuggestion {
  return {
    lane: 'Deep focus',
    query: 'calm instrumental focus',
    trackId: name,
    uri: `spotify:track:${name}`,
    name,
    description: null,
    imageUrl: null,
    externalUrl: `https://open.spotify.com/playlist/${name}`,
    artistName: 'Fuzzy Ensemble'
  }
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('spotifyStore', () => {
  const suggestForMood = vi.fn()
  const playSuggestion = vi.fn()
  const restorePlayback = vi.fn()
  const openSuggestion = vi.fn(async () => ({ ok: true }))

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('window', {
      fuzzy: {
        spotify: {
          suggestForMood,
          playSuggestion,
          restorePlayback,
          openSuggestion
        }
      }
    })
    useSpotifyStore.setState({
      suggestion: null,
      suggestionStatus: 'idle',
      currentClassification: null,
      recentUris: [],
      lastAutoAt: 0,
      requesting: false,
      playbackState: 'idle',
      playbackMessage: null,
      undoSnapshot: null
    })
  })

  it('keeps the newest manual result when an older search finishes later', async () => {
    const older = deferred<SpotifySuggestion | null>()
    const newer = deferred<SpotifySuggestion | null>()
    suggestForMood.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)

    const olderRequest = useSpotifyStore.getState().requestSuggestion(calmClassification)
    const newerRequest = useSpotifyStore
      .getState()
      .requestSuggestion({ ...calmClassification, mood: 'tension' })

    const newerSuggestion = suggestion('newer')
    newer.resolve(newerSuggestion)
    await newerRequest
    older.resolve(suggestion('older'))
    await olderRequest

    expect(useSpotifyStore.getState().suggestion).toEqual(newerSuggestion)
    expect(useSpotifyStore.getState().suggestionStatus).toBe('ready')
  })

  it('opens the exact suggestion supplied by a fresh manual search', async () => {
    const current = suggestion('current')
    const fresh = suggestion('fresh')
    useSpotifyStore.setState({ suggestion: current, suggestionStatus: 'ready' })

    await useSpotifyStore.getState().openSuggestion(fresh)

    expect(openSuggestion).toHaveBeenCalledWith(fresh)
  })

  it('excludes recently rejected tracks from the next passage search', async () => {
    const rejected = suggestion('rejected')
    const fresh = suggestion('fresh')
    useSpotifyStore.setState({ recentUris: [rejected.uri!] })
    suggestForMood.mockResolvedValue(fresh)

    await useSpotifyStore.getState().requestSuggestion(calmClassification)

    expect(suggestForMood).toHaveBeenCalledWith(calmClassification, {
      excludeUris: [rejected.uri]
    })
    expect(useSpotifyStore.getState().recentUris).toEqual([fresh.uri, rejected.uri])
  })

  it('captures the previous track so a soundtrack swap can be undone', async () => {
    const fresh = suggestion('fresh')
    const previous = {
      uri: 'spotify:track:previous',
      name: 'Previous',
      artistName: 'Earlier Artist',
      imageUrl: null,
      externalUrl: 'https://open.spotify.com/track/previous',
      progressMs: 42_000
    }
    playSuggestion.mockResolvedValue({
      ok: true,
      started: true,
      openedExternal: false,
      previous
    })

    await useSpotifyStore.getState().playSuggestion(fresh)

    expect(useSpotifyStore.getState().playbackState).toBe('playing')
    expect(useSpotifyStore.getState().undoSnapshot).toEqual(previous)
  })

  it('restores the previous track and clears the one-shot undo', async () => {
    const previous = {
      uri: 'spotify:track:previous',
      name: 'Previous',
      artistName: 'Earlier Artist',
      imageUrl: null,
      externalUrl: 'https://open.spotify.com/track/previous',
      progressMs: 42_000
    }
    useSpotifyStore.setState({ undoSnapshot: previous })
    restorePlayback.mockResolvedValue({ ok: true })

    await useSpotifyStore.getState().undoLastSwap()

    expect(restorePlayback).toHaveBeenCalledWith(previous)
    expect(useSpotifyStore.getState().suggestion?.uri).toBe(previous.uri)
    expect(useSpotifyStore.getState().undoSnapshot).toBeNull()
  })
})

describe('isMeaningfulSoundtrackShift', () => {
  it('ignores small intensity drift inside the same scene', () => {
    expect(
      isMeaningfulSoundtrackShift(calmClassification, {
        ...calmClassification,
        intensity: 0.45
      })
    ).toBe(false)
  })

  it('reacts to mood, scene, or major intensity changes', () => {
    expect(
      isMeaningfulSoundtrackShift(calmClassification, {
        ...calmClassification,
        mood: 'tension'
      })
    ).toBe(true)
    expect(
      isMeaningfulSoundtrackShift(calmClassification, {
        ...calmClassification,
        sceneTags: ['storm']
      })
    ).toBe(true)
    expect(
      isMeaningfulSoundtrackShift(calmClassification, {
        ...calmClassification,
        intensity: 0.7
      })
    ).toBe(true)
  })
})
