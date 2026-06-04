import OpenAI from 'openai'
import type { AiActionRequest, AiActionResult } from '@shared/types/database'
import { buildUserMessage, getSystemPrompt } from './prompts'
import { getDecryptedOpenaiKey, readSettings } from '../settingsService'

let client: OpenAI | null = null
let cachedKey: string | null = null

const MAX_COMPLETION_TOKENS = 900
const REQUEST_TIMEOUT_MS = 30_000

function getClient(): OpenAI {
  const key = getDecryptedOpenaiKey()
  if (!key) {
    throw new SanitizedOpenAiError(
      'no_api_key',
      'No OpenAI key configured. Add one in Settings or switch to mock mode.'
    )
  }
  if (!client || cachedKey !== key) {
    client = new OpenAI({ apiKey: key, timeout: REQUEST_TIMEOUT_MS })
    cachedKey = key
  }
  return client
}

// Thrown by runOpenAiAction with a stable code + a renderer-safe message.
// The original SDK error never crosses the IPC boundary.
export class SanitizedOpenAiError extends Error {
  constructor(
    public readonly code:
      | 'no_api_key'
      | 'unauthorized'
      | 'rate_limited'
      | 'timeout'
      | 'network'
      | 'bad_request'
      | 'server'
      | 'empty_response'
      | 'unknown',
    message: string
  ) {
    super(message)
    this.name = 'SanitizedOpenAiError'
  }
}

function classifyError(err: unknown): SanitizedOpenAiError {
  if (err instanceof SanitizedOpenAiError) return err
  // OpenAI SDK errors expose `status` and `name`. We deliberately ignore
  // `message` because it can echo masked-key prefixes, URLs, and headers.
  const status = (err as { status?: number } | null)?.status
  const name = (err as { name?: string } | null)?.name ?? ''
  if (status === 401 || status === 403) {
    return new SanitizedOpenAiError(
      'unauthorized',
      'Your OpenAI key was rejected. Check it in Settings.'
    )
  }
  if (status === 429) {
    return new SanitizedOpenAiError(
      'rate_limited',
      'OpenAI is rate-limiting your account. Try again in a moment.'
    )
  }
  if (status === 400) {
    return new SanitizedOpenAiError(
      'bad_request',
      'OpenAI rejected the request. Try a shorter passage.'
    )
  }
  if (status && status >= 500) {
    return new SanitizedOpenAiError(
      'server',
      'OpenAI had a problem on their side. Try again shortly.'
    )
  }
  if (name === 'APITimeoutError' || name === 'AbortError') {
    return new SanitizedOpenAiError(
      'timeout',
      'The request timed out. Try again or shorten the passage.'
    )
  }
  if (name === 'APIConnectionError') {
    return new SanitizedOpenAiError(
      'network',
      'Could not reach OpenAI. Check your internet connection.'
    )
  }
  return new SanitizedOpenAiError('unknown', 'The AI request failed. Try again.')
}

export async function runOpenAiAction(request: AiActionRequest): Promise<AiActionResult> {
  const settings = readSettings()
  const model = settings.openaiModel
  const system = getSystemPrompt(request.action)
  const userMessage = buildUserMessage(request.action, request.selectedText, request.contextText, {
    conversationHistory: request.conversationHistory,
    followUpText: request.followUpText
  })

  const openai = getClient()
  const startedAt = Date.now()
  let completion
  try {
    completion = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage }
      ]
    })
  } catch (err) {
    // Log the raw error in main only; surface a sanitized one to the renderer.
    console.error('[fuzzy ai] openai request failed', err)
    throw classifyError(err)
  }
  const latencyMs = Date.now() - startedAt

  const choice = completion.choices?.[0]?.message?.content?.trim()
  if (!choice) {
    throw new SanitizedOpenAiError('empty_response', 'The AI returned no content.')
  }

  const usage = completion.usage ?? null
  return {
    outputText: choice,
    model,
    provider: 'openai',
    inputTokens: usage?.prompt_tokens ?? null,
    outputTokens: usage?.completion_tokens ?? null,
    latencyMs,
    fallbackReason: null
  }
}
