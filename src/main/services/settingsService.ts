import OpenAI from 'openai'
import { safeStorage } from 'electron'
import { deleteSetting, getSetting, setSetting } from '../db/repositories/settingsRepository'
import type {
  AppSettings,
  AppearancePrefs,
  ObsidianPrefs,
  ProviderMode,
  ReaderPrefs,
  StudyPackPrefs
} from '@shared/types/database'
import {
  DEFAULT_APPEARANCE_PREFS,
  DEFAULT_OBSIDIAN_PREFS,
  DEFAULT_READER_PREFS,
  DEFAULT_STUDY_PACK_PREFS,
  normalizeAppearancePrefs,
  normalizeObsidianPrefs,
  normalizeReaderPrefs,
  normalizeStudyPackPrefs
} from '@shared/types/database'
import type { ValidateOpenaiKeyResult } from '@shared/types/api'

const KEY_PROVIDER_MODE = 'provider.mode'
const KEY_OPENAI_MODEL = 'openai.model'
const KEY_OPENAI_API_KEY_ENC = 'openai.apiKey.enc.b64'
const KEY_OPENAI_BASE_URL = 'openai.baseUrl'
const KEY_LAST_ACTIVE_DOCUMENT_ID = 'reader.lastActiveDocumentId'
const KEY_READER_PREFS = 'reader.prefs'
const KEY_APPEARANCE_PREFS = 'appearance.prefs'
const KEY_STUDY_PACK_PREFS = 'studyPack.prefs'
const KEY_OBSIDIAN_PREFS = 'obsidian.prefs'

// Lexical sanity guard: rejects obviously-not-a-key strings (whitespace, way
// too short) before they touch safeStorage. We deliberately DON'T require the
// OpenAI `sk-` prefix — Fuzzy defaults to free OpenAI-compatible providers whose
// keys use other prefixes (Groq `gsk_…`, OpenRouter `sk-or-…`) or none at all
// (Ollama/local). The live `validateOpenaiKey()` probe against the configured
// endpoint is the authoritative check.
const API_KEY_SHAPE_RE = /^[A-Za-z0-9_.-]{16,}$/
const VALIDATE_KEY_TIMEOUT_MS = 5_000

// Free-by-default model wiring. Fuzzy now defaults to Groq's free,
// OpenAI-compatible endpoint + Llama 3.3 70B, so BYOK works without a paid
// OpenAI account (the user only needs a free Groq `gsk_…` key). Both defaults
// are still overridable per-install from Settings (model + base URL).
const DEFAULT_OPENAI_BASE_URL: string | null = 'https://api.groq.com/openai/v1'
const DEFAULT_OPENAI_MODEL = 'llama-3.3-70b-versatile'
const OFFICIAL_OPENAI_BASE_URL = 'https://api.openai.com/v1'
const OFFICIAL_OPENAI_MODEL = 'gpt-4.1-mini'

// --- Paid OpenAI defaults (commented out — restore both to switch back) ---
// const DEFAULT_OPENAI_BASE_URL: string | null = null // null = OpenAI endpoint
// const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'

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

// OpenAI-compatible base URL. A stored value (set in Settings) wins; otherwise
// we fall back to DEFAULT_OPENAI_BASE_URL — now the free Groq endpoint, so a
// fresh install talks to a free provider instead of paid OpenAI. To target
// OpenAI again, set the base URL to https://api.openai.com/v1 in Settings (or
// restore the commented paid defaults above).
export function getOpenaiBaseUrl(): string | null {
  const v = getSetting(KEY_OPENAI_BASE_URL)
  return v && v.trim() ? v.trim() : DEFAULT_OPENAI_BASE_URL
}

export function readSettings(): AppSettings {
  return {
    providerMode: readProviderMode(),
    openaiModel: readOpenaiModel(),
    hasOpenaiKey: hasOpenaiKey(),
    openaiBaseUrl: getOpenaiBaseUrl(),
    lastActiveDocumentId: readLastActiveDocumentId()
  }
}

export function writeOpenaiBaseUrl(url: string | null): AppSettings {
  if (!url || !url.trim()) {
    deleteSetting(KEY_OPENAI_BASE_URL)
  } else {
    setSetting(KEY_OPENAI_BASE_URL, url.trim())
  }
  return readSettings()
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
  // Provider-agnostic sanity check only (no `sk-` requirement) so Groq/
  // OpenRouter/Ollama/OpenAI keys all save. The endpoint probe is authoritative.
  if (!API_KEY_SHAPE_RE.test(trimmed)) {
    // Static message: never includes any portion of the candidate key. The
    // renderer renders a generic "double-check it" hint based on this.
    throw new Error('invalid API key shape')
  }
  const enc = safeStorage.encryptString(trimmed)
  setSetting(KEY_OPENAI_API_KEY_ENC, enc.toString('base64'))

  // An official OpenAI key cannot authenticate against Fuzzy's free Groq
  // defaults. When those defaults are still active, configure a compatible,
  // low-latency OpenAI model automatically so saving the key is enough.
  const usingFreeDefaults =
    getOpenaiBaseUrl() === DEFAULT_OPENAI_BASE_URL && readOpenaiModel() === DEFAULT_OPENAI_MODEL
  if (/^sk-(?!or-)/.test(trimmed) && usingFreeDefaults) {
    setSetting(KEY_PROVIDER_MODE, 'openai')
    setSetting(KEY_OPENAI_BASE_URL, OFFICIAL_OPENAI_BASE_URL)
    setSetting(KEY_OPENAI_MODEL, OFFICIAL_OPENAI_MODEL)
  }
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
  const baseURL = getOpenaiBaseUrl()
  const trimmed = typeof key === 'string' ? key.trim() : ''
  if (!trimmed) return { ok: false, code: 'unauthorized' }
  // Provider-agnostic sanity check; the live probe below is what really decides.
  if (!API_KEY_SHAPE_RE.test(trimmed)) {
    return { ok: false, code: 'unauthorized' }
  }
  // Probe the SAME endpoint the app will use, so Groq/OpenRouter/Ollama keys
  // validate against their own /models, not OpenAI's.
  const probe = new OpenAI({
    apiKey: trimmed,
    timeout: VALIDATE_KEY_TIMEOUT_MS,
    baseURL: baseURL ?? undefined
  })
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

// Reader preferences — stored as one JSON blob. Reads always go through
// normalizeReaderPrefs so a corrupt/legacy value degrades to defaults instead
// of crashing the renderer.
export function readReaderPrefs(): ReaderPrefs {
  const raw = getSetting(KEY_READER_PREFS)
  if (!raw) return DEFAULT_READER_PREFS
  try {
    return normalizeReaderPrefs(JSON.parse(raw))
  } catch {
    return DEFAULT_READER_PREFS
  }
}

export function writeReaderPrefs(patch: Partial<ReaderPrefs>): ReaderPrefs {
  const merged = normalizeReaderPrefs({ ...readReaderPrefs(), ...patch })
  setSetting(KEY_READER_PREFS, JSON.stringify(merged))
  return merged
}

// Appearance preferences — theme + accent, stored as one JSON blob. Same
// read-through-normalize discipline as reader prefs so a corrupt/legacy value
// degrades to defaults rather than crashing the theme layer.
export function readAppearancePrefs(): AppearancePrefs {
  const raw = getSetting(KEY_APPEARANCE_PREFS)
  if (!raw) return DEFAULT_APPEARANCE_PREFS
  try {
    return normalizeAppearancePrefs(JSON.parse(raw))
  } catch {
    return DEFAULT_APPEARANCE_PREFS
  }
}

export function writeAppearancePrefs(patch: Partial<AppearancePrefs>): AppearancePrefs {
  const merged = normalizeAppearancePrefs({ ...readAppearancePrefs(), ...patch })
  setSetting(KEY_APPEARANCE_PREFS, JSON.stringify(merged))
  return merged
}

// Study-pack preferences — last-used generation options + export/SR settings,
// stored as one JSON blob with the same read-through-normalize discipline.
export function readStudyPackPrefs(): StudyPackPrefs {
  const raw = getSetting(KEY_STUDY_PACK_PREFS)
  if (!raw) return DEFAULT_STUDY_PACK_PREFS
  try {
    return normalizeStudyPackPrefs(JSON.parse(raw))
  } catch {
    return DEFAULT_STUDY_PACK_PREFS
  }
}

export function writeStudyPackPrefs(patch: Partial<StudyPackPrefs>): StudyPackPrefs {
  const merged = normalizeStudyPackPrefs({ ...readStudyPackPrefs(), ...patch })
  setSetting(KEY_STUDY_PACK_PREFS, JSON.stringify(merged))
  return merged
}

// Obsidian notes-sync preferences — vault folder + per-document note filename
// map, stored as one JSON blob with the same read-through-normalize discipline.
export function readObsidianPrefs(): ObsidianPrefs {
  const raw = getSetting(KEY_OBSIDIAN_PREFS)
  if (!raw) return DEFAULT_OBSIDIAN_PREFS
  try {
    return normalizeObsidianPrefs(JSON.parse(raw))
  } catch {
    return DEFAULT_OBSIDIAN_PREFS
  }
}

export function writeObsidianPrefs(patch: Partial<ObsidianPrefs>): ObsidianPrefs {
  const merged = normalizeObsidianPrefs({ ...readObsidianPrefs(), ...patch })
  setSetting(KEY_OBSIDIAN_PREFS, JSON.stringify(merged))
  return merged
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
