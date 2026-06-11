// AI roster refinement: one cheap LLM call that filters the auto-extracted
// character list down to actual people, dropping spells/places/objects that the
// offline proper-noun pass can't distinguish. Best-effort — any failure (no key,
// mock mode, API error, unparseable reply) keeps the local roster unchanged.

import OpenAI from 'openai'
import type { ExtractedEntity } from '@shared/types/database'
import { resolveProviderMode } from '../ai/provider'
import { getDecryptedOpenaiKey, getOpenaiBaseUrl, readSettings } from '../settingsService'
import { applyKeptNames, buildRefinePrompt, parseKeptNames } from './entityRefineCore'

const REQUEST_TIMEOUT_MS = 20_000

// Returns the refined roster plus whether the AI pass actually ran (so callers
// can record the index source as 'llm' vs 'local').
export async function refineCharacterRoster(
  entities: ExtractedEntity[]
): Promise<{ entities: ExtractedEntity[]; refined: boolean }> {
  if (entities.length === 0) return { entities, refined: false }
  if (resolveProviderMode().mode !== 'openai') return { entities, refined: false }
  const key = getDecryptedOpenaiKey()
  if (!key) return { entities, refined: false }

  const client = new OpenAI({
    apiKey: key,
    timeout: REQUEST_TIMEOUT_MS,
    baseURL: getOpenaiBaseUrl() ?? undefined
  })
  const { system, user } = buildRefinePrompt(entities)
  try {
    const completion = await client.chat.completions.create({
      model: readSettings().openaiModel,
      temperature: 0,
      max_completion_tokens: 800,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
    const text = completion.choices?.[0]?.message?.content ?? ''
    const kept = parseKeptNames(text)
    if (kept.size === 0) return { entities, refined: false }
    return { entities: applyKeptNames(entities, kept), refined: true }
  } catch (err) {
    console.warn('[fuzzy entities] roster refine failed; keeping local roster', err)
    return { entities, refined: false }
  }
}
