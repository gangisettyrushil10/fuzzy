import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AmbientClassification } from '../src/shared/types/api'

const mocks = vi.hoisted(() => ({
  createResponse: vi.fn(),
  getDecryptedOpenaiKey: vi.fn(),
  getOpenaiBaseUrl: vi.fn(),
  readSettings: vi.fn(),
  readGenrePreferences: vi.fn()
}))

vi.mock('openai', () => ({
  default: class MockOpenAI {
    responses = { create: mocks.createResponse }
  }
}))
vi.mock('../src/main/services/settingsService', () => ({
  getDecryptedOpenaiKey: mocks.getDecryptedOpenaiKey,
  getOpenaiBaseUrl: mocks.getOpenaiBaseUrl,
  readSettings: mocks.readSettings
}))
vi.mock('../src/main/services/spotify/spotifyTokenStore', () => ({
  readGenrePreferences: mocks.readGenrePreferences
}))

import {
  clearSoundtrackQueryCache,
  planSoundtrackQuery
} from '../src/main/services/spotify/soundtrackQueryService'

const classification: AmbientClassification = {
  mood: 'tension',
  secondaryMood: 'fear',
  genre: 'mystery',
  type: 'fiction',
  intensity: 0.72,
  sceneTags: ['rain', 'night'],
  paletteHints: ['slate'],
  motion: 'pulse'
}

describe('soundtrackQueryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearSoundtrackQueryCache()
    mocks.getDecryptedOpenaiKey.mockReturnValue('sk-test-key-with-enough-characters')
    mocks.getOpenaiBaseUrl.mockReturnValue('https://api.openai.com/v1')
    mocks.readSettings.mockReturnValue({
      providerMode: 'openai',
      openaiModel: 'gpt-4.1-mini',
      hasOpenaiKey: true,
      openaiBaseUrl: 'https://api.openai.com/v1',
      lastActiveDocumentId: null
    })
    mocks.readGenrePreferences.mockReturnValue(['jazz'])
  })

  it('turns the visible passage into a structured track-search plan', async () => {
    mocks.createResponse.mockResolvedValue({
      output_text: JSON.stringify({
        lane: 'Rain-soaked suspense',
        query: 'rainy noir jazz brushed drums tense instrumental'
      })
    })

    const plan = await planSoundtrackQuery(
      classification,
      'Rain ran down the glass as the footsteps stopped outside.'
    )

    expect(plan).toEqual({
      lane: 'Rain-soaked suspense',
      query: 'rainy noir jazz brushed drums tense instrumental',
      source: 'openai'
    })
    expect(mocks.createResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4.1-mini',
        text: { format: expect.objectContaining({ type: 'json_schema', strict: true }) }
      })
    )
    expect(JSON.stringify(mocks.createResponse.mock.calls[0][0].input)).toContain(
      'footsteps stopped outside'
    )
  })

  it('uses the deterministic mood mapping when OpenAI is unavailable', async () => {
    mocks.getDecryptedOpenaiKey.mockReturnValue(null)

    const plan = await planSoundtrackQuery(classification, 'A tense rain scene.')

    expect(plan.source).toBe('fallback')
    expect(plan.query).toContain('jazz')
    expect(plan.query).not.toContain('playlist')
    expect(mocks.createResponse).not.toHaveBeenCalled()
  })

  it('rejects AI plans that ask Spotify for a playlist', async () => {
    mocks.createResponse.mockResolvedValue({
      output_text: JSON.stringify({ lane: 'Suspense', query: 'dark suspense playlist' })
    })

    const plan = await planSoundtrackQuery(classification, 'A tense rain scene.')

    expect(plan.source).toBe('fallback')
    expect(plan.query).not.toContain('playlist')
  })
})
