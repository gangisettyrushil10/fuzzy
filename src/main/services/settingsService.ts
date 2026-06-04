import OpenAI from 'openai'
import { safeStorage } from 'electron'
import { deleteSetting, getSetting, setSetting } from '../db/repositories/settingsRepository'
import type { AppSettings, ProviderMode } from '@shared/types/database'
import type { ValidateOpenaiKeyResult } from '@shared/types/api'

const KEY_PROVIDER_MODE = 'provider.mode'
const KEY_OPENAI_MODEL = 'openai.model'
const KEY_OPENAI_API_KEY_ENC = 'openai.apiKey.enc.b64'
const KEY_LAST_ACTIVE_DOCUMENT_ID = 'reader.lastActiveDocumentId'

// Lexical guard: rejects obviously-not-a-key strings before they ever touch
// safeStorage. The live `validateOpenaiKey()` call is the authoritative check.
const OPENAI_KEY_SHAPE_RE = /^sk-[A-Za-z0-9_-]{20,}$/
const VALIDATE_KEY_TIMEOUT_MS = 5_000

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'

function readProviderMode(): ProviderMode {
  const v = getSetting(KEY_PROVIDER_MODE)
  return v === 'openai' ? 'openai' : 'mock'
}

function readOpenaiModel(): string {
  return getSetting(KEY_OPENAI_MODEL) ?? DEFAULT_OPENAI_MODEL
}

function hasOpenaiKey(): boolean {
  return getSetting(KEY_OPENAI_API_KEY_ENC) !== null
}

function readLastActiveDocumentId(): string | null {
  return getSetting(KEY_LAST_ACTIVE_DOCUMENT_ID)
}

export function readSettings(): AppSettings {
  return {
    providerMode: readProviderMode(),
    openaiModel: readOpenaiModel(),
    hasOpenaiKey: hasOpenaiKey(),
    lastActiveDocumentId: readLastActiveDocumentId()
  }
}

export function writeProviderMode(mode: ProviderMode): AppSettings {
  setSetting(KEY_PROVIDER_MODE, mode)
  return readSettings()
}

export function writeOpenaiModel(model: string): AppSettings {
  const trimmed = model.trim() || DEFAULT_OPENAI_MODEL
  setSetting(KEY_OPENAI_MODEL, trimmed)
  return readSettings()
}

export function writeOpenaiKey(plaintextKey: string): AppSettings {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'Secure storage is not available on this machine. Sign in to your Mac account and try again.'
    )
  }
  const trimmed = plaintextKey.trim()
  if (!trimmed) {
    throw new Error('API key cannot be empty.')
  }
  if (!OPENAI_KEY_SHAPE_RE.test(trimmed)) {
    // Static message: never includes any portion of the candidate key. The
    // renderer renders a generic "double-check it" hint based on this.
    throw new Error('invalid API key shape')
  }
  const enc = safeStorage.encryptString(trimmed)
  setSetting(KEY_OPENAI_API_KEY_ENC, enc.toString('base64'))
  return readSettings()
}

// Classifier mirrors the openaiProvider.ts mapper. Kept local to avoid a
// circular import between settingsService <-> openaiProvider.
function classifyValidationError(err: unknown): ValidateOpenaiKeyResult {
  const status = (err as { status?: number } | null)?.status
  const name = (err as { name?: string } | null)?.name ?? ''
  if (status === 401 || status === 403) return { ok: false, code: 'unauthorized' }
  if (name === 'APITimeoutError' || name === 'AbortError') return { ok: false, code: 'timeout' }
  if (name === 'APIConnectionError') return { ok: false, code: 'network' }
  return { ok: false, code: 'unknown' }
}

// Probe a candidate key with a single cheap call (`models.list`) and a hard
// 5s timeout. Uses a throwaway OpenAI client so we never mutate the cached
// production client.
export async function validateOpenaiKey(key: string): Promise<ValidateOpenaiKeyResult> {
  if (typeof key !== 'string' || !OPENAI_KEY_SHAPE_RE.test(key.trim())) {
    return { ok: false, code: 'unauthorized' }
  }
  const probe = new OpenAI({ apiKey: key.trim(), timeout: VALIDATE_KEY_TIMEOUT_MS })
  try {
    await probe.models.list()
    return { ok: true }
  } catch (err) {
    console.error('[fuzzy settings] openai key validation failed', err)
    return classifyValidationError(err)
  }
}

export function clearOpenaiKey(): AppSettings {
  deleteSetting(KEY_OPENAI_API_KEY_ENC)
  return readSettings()
}

export function writeLastActiveDocumentId(id: string | null): AppSettings {
  if (id === null || id === '') {
    deleteSetting(KEY_LAST_ACTIVE_DOCUMENT_ID)
  } else {
    setSetting(KEY_LAST_ACTIVE_DOCUMENT_ID, id)
  }
  return readSettings()
}

// Used only inside main-process AI flows. Never exposed back to the renderer.
export function getDecryptedOpenaiKey(): string | null {
  const stored = getSetting(KEY_OPENAI_API_KEY_ENC)
  if (!stored) return null
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'))
  } catch (err) {
    console.error('[fuzzy settings] failed to decrypt openai key', err)
    return null
  }
}
