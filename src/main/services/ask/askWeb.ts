import type { RankedPassage, WebSource } from '@shared/types/database'

// Pure, electron-free helpers for the "search the web" Ask path, so they can be
// unit-tested without the OpenAI client or settings (which pull in electron).

// Candidate models (in priority order) that can search the live web for the
// user's configured provider, inferred from the base URL. We try each until one
// works, so we survive provider model-name drift (e.g. Groq's compound system
// has been published as both `groq/compound` and `compound-beta`).
//
//  - Groq → its agentic "compound" system (built-in web search), both naming eras.
//  - OpenRouter → any model with the `:online` suffix (adds a web plugin).
//  - OpenAI / unknown → the configured model unchanged (works if it's already
//    search-capable; otherwise it just answers from the passages — safe).
export function webSearchModels(baseUrl: string | null, model: string): string[] {
  const b = (baseUrl ?? '').toLowerCase()
  if (b.includes('openrouter')) return [model.includes(':online') ? model : `${model}:online`]
  if (b.includes('groq')) return ['groq/compound', 'compound-beta']
  return [model]
}

// Back-compat single-model helper (first candidate).
export function deriveSearchModel(baseUrl: string | null, model: string): string {
  return webSearchModels(baseUrl, model)[0]
}

// Compact document context for the web-search path. Groq's `compound` system
// caps request size far tighter than the regular chat models (a full 8-passage
// block 413s), and on this path the document is only secondary context — the web
// is the main source — so we send just the top few passages, each truncated.
export function compactPassageBlock(
  passages: RankedPassage[],
  maxPassages = 3,
  maxCharsEach = 400
): string {
  return passages
    .slice(0, maxPassages)
    .map((p, i) => {
      const snippet = p.snippet.length > maxCharsEach ? `${p.snippet.slice(0, maxCharsEach)}…` : p.snippet
      return `P${i + 1} (p. ${p.pageNumber}): ${snippet}`
    })
    .join('\n')
}

// Pull URL citations out of a chat message. OpenRouter (`:online`) and OpenAI
// return them as `annotations[].url_citation { url, title }`. Tolerant of shape
// drift across providers, deduped by URL, and a no-op when none are present.
export function extractWebSources(message: unknown): WebSource[] {
  const out: WebSource[] = []
  const seen = new Set<string>()
  const annotations = (message as { annotations?: unknown })?.annotations
  if (!Array.isArray(annotations)) return out
  for (const a of annotations) {
    const cite = (a as { url_citation?: { url?: unknown; title?: unknown } })?.url_citation
    const url = cite?.url
    if (typeof url !== 'string' || seen.has(url)) continue
    seen.add(url)
    out.push({ url, title: typeof cite?.title === 'string' && cite.title ? cite.title : url })
    if (out.length >= 8) break
  }
  return out
}
