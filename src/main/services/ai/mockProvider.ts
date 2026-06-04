import type { AiActionRequest, AiActionResult } from '@shared/types/database'

// Deterministic, network-free responses so the full UX loop works with no key.
// Tone matches the real prompts so the renderer never has to special-case mock.
export async function runMockAction(request: AiActionRequest): Promise<AiActionResult> {
  const { action, selectedText } = request
  const trimmed = selectedText.trim().replace(/\s+/g, ' ')
  const preview = trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed

  const followUp = request.followUpText?.trim()
  const text = followUp
    ? `Mock follow-up answer: regarding your question — "${followUp.slice(0, 120)}" — the passage ("${preview}") suggests the author is extending the earlier claim. (Offline mock mode.)`
    : buildBody(action, preview)
  const startedAt = Date.now()
  // Tiny artificial delay so the loading state is visible.
  await new Promise((r) => setTimeout(r, 250))
  return {
    outputText: text,
    model: 'fuzzy-mock-v1',
    provider: 'mock',
    inputTokens: null,
    outputTokens: null,
    latencyMs: Date.now() - startedAt,
    fallbackReason: null
  }
}

function buildBody(action: string, preview: string): string {
  switch (action) {
    case 'explain':
      return [
        `Mock explanation: this passage is talking about — "${preview}"`,
        '',
        'In plain terms, the author is making a point and supporting it with one or two reasons. The surrounding context tells us this is part of a larger argument, not a standalone claim.',
        '',
        'Why it matters: knowing this passage gives you the building block the next section will lean on.'
      ].join('\n')

    case 'simplify':
      return [
        'Simpler version (mock):',
        '',
        `The passage — "${preview}" — basically says one main thing, told in a more formal way. The plain-English version keeps the meaning but uses everyday words.`,
        '',
        'Lost nuance: technical terms here often carry precise meaning, so keep the original handy if accuracy matters.'
      ].join('\n')

    case 'summarize':
      return [
        'Summary (mock):',
        `• Main point: "${preview}"`,
        '• Supporting reason: the author leans on prior context to justify this claim.',
        '• Takeaway: read the next paragraph to see how this idea is used.'
      ].join('\n')

    case 'define':
      return [
        'Definition (mock):',
        '',
        `Based on this passage, the highlighted term is being used to mean — roughly — what the surrounding context implies for "${preview}".`,
        '',
        'If the term has multiple senses, the one used here is the one consistent with the argument the author is making in this section.'
      ].join('\n')

    case 'example':
      return [
        'Concrete example (mock):',
        '',
        `Imagine a small, everyday situation that mirrors the structure of "${preview}". A waiter taking three orders at once is a useful stand-in: the same logic shows up, just on a smaller scale.`
      ].join('\n')

    case 'quiz':
      return [
        'Quiz (mock):',
        '',
        `Q: In your own words, what is the central claim of "${preview}"?`,
        'A: It asserts the main idea above and depends on the surrounding context to justify it.',
        '',
        'Q: What would weaken this claim?',
        'A: A counterexample from the same context that contradicts the supporting reason.'
      ].join('\n')

    default:
      return `Mock response for action "${action}" on: "${preview}"`
  }
}
