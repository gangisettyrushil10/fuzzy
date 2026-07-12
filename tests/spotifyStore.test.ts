import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AmbientClassification, SpotifySuggestion } from '../src/shared/types/api'
import { useSpotifyStore } from '../src/renderer/src/state/spotifyStore'

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
    playlistId: name,
    name,
    description: null,
    imageUrl: null,
    externalUrl: `https://open.spotify.com/playlist/${name}`,
    ownerName: null
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
  const openSuggestion = vi.fn(async () => ({ ok: true }))

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('window', {
      fuzzy: {
        spotify: {
          suggestForMood,
          openSuggestion
        }
      }
    })
    useSpotifyStore.setState({
      suggestion: null,
      suggestionStatus: 'idle',
      lastAutoMood: null,
      lastAutoAt: 0,
      requesting: false
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
})
