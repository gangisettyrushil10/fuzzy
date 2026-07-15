import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const settings = new Map<string, string>()
  return {
    settings,
    encryptString: vi.fn((value: string) => Buffer.from(`encrypted:${value}`)),
    decryptString: vi.fn((value: Buffer) => value.toString().replace(/^encrypted:/, ''))
  }
})

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: mocks.encryptString,
    decryptString: mocks.decryptString
  }
}))
vi.mock('../src/main/db/repositories/settingsRepository', () => ({
  getSetting: (key: string) => mocks.settings.get(key) ?? null,
  setSetting: (key: string, value: string) => mocks.settings.set(key, value),
  deleteSetting: (key: string) => mocks.settings.delete(key)
}))

import { readSettings, writeOpenaiKey } from '../src/main/services/settingsService'

describe('OpenAI key configuration', () => {
  beforeEach(() => {
    mocks.settings.clear()
    vi.clearAllMocks()
  })

  it('switches untouched free-provider defaults when an official key is saved', () => {
    const settings = writeOpenaiKey('sk-proj-test-key-with-enough-characters')

    expect(settings).toMatchObject({
      providerMode: 'openai',
      openaiBaseUrl: 'https://api.openai.com/v1',
      openaiModel: 'gpt-4.1-mini',
      hasOpenaiKey: true
    })
  })

  it('does not reinterpret a Groq key as an OpenAI key', () => {
    const settings = writeOpenaiKey('gsk_test_key_with_enough_characters')

    expect(settings).toMatchObject({
      providerMode: 'mock',
      openaiBaseUrl: 'https://api.groq.com/openai/v1',
      openaiModel: 'llama-3.3-70b-versatile',
      hasOpenaiKey: true
    })
  })

  it('preserves a deliberate custom endpoint and model', () => {
    mocks.settings.set('openai.baseUrl', 'http://localhost:11434/v1')
    mocks.settings.set('openai.model', 'local-model')

    writeOpenaiKey('sk-proj-test-key-with-enough-characters')

    expect(readSettings()).toMatchObject({
      providerMode: 'mock',
      openaiBaseUrl: 'http://localhost:11434/v1',
      openaiModel: 'local-model'
    })
  })
})
