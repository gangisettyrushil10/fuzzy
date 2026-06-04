import type { AiActionRequest, AiActionResult, ProviderMode } from '@shared/types/database'
import { runMockAction } from './mockProvider'
import { runOpenAiAction, SanitizedOpenAiError } from './openaiProvider'
import { getDecryptedOpenaiKey, readSettings } from '../settingsService'

export interface AiProviderResolution {
  mode: ProviderMode
  reason?: 'no_api_key'
}

// Always returns a usable mode. If the user picked openai but has no key,
// transparently fall back to mock so the UI never dead-ends — and report
// the reason so the renderer can surface it.
export function resolveProviderMode(): AiProviderResolution {
  const settings = readSettings()
  if (settings.providerMode === 'openai') {
    const key = getDecryptedOpenaiKey()
    if (!key) return { mode: 'mock', reason: 'no_api_key' }
    return { mode: 'openai' }
  }
  return { mode: 'mock' }
}

export async function runAiAction(request: AiActionRequest): Promise<AiActionResult> {
  const resolution = resolveProviderMode()
  if (resolution.mode === 'openai') {
    return runOpenAiAction(request)
  }
  const result = await runMockAction(request)
  return { ...result, fallbackReason: resolution.reason ?? null }
}

export { SanitizedOpenAiError }
