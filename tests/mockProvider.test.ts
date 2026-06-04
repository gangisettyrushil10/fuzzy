import { describe, expect, it } from 'vitest'
import { runMockAction } from '../src/main/services/ai/mockProvider'
import type { AiActionRequest, AiActionType } from '../src/shared/types/database'

function req(action: AiActionType, selectedText = 'the quick brown fox'): AiActionRequest {
  return {
    documentId: 'doc-1',
    pageNumber: 1,
    action,
    selectedText,
    contextText: null
  }
}

describe('runMockAction', () => {
  it('produces non-empty output for every public action', async () => {
    for (const action of [
      'explain',
      'simplify',
      'summarize',
      'define',
      'example',
      'quiz'
    ] as const) {
      const result = await runMockAction(req(action))
      expect(result.outputText.length).toBeGreaterThan(20)
      expect(result.provider).toBe('mock')
      expect(result.model).toBe('fuzzy-mock-v1')
    }
  })

  it('reports latency >= 0', async () => {
    const result = await runMockAction(req('explain'))
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('returns null token counts (mock does not call any API)', async () => {
    const result = await runMockAction(req('summarize'))
    expect(result.inputTokens).toBeNull()
    expect(result.outputTokens).toBeNull()
  })

  it('echoes a preview of the selected text', async () => {
    const selection = 'a rare and specific phrase about cataclysmic kittens'
    const result = await runMockAction(req('explain', selection))
    expect(result.outputText).toContain('cataclysmic kittens')
  })

  it('truncates the preview for very long selections', async () => {
    const longText = 'x'.repeat(500)
    const result = await runMockAction(req('explain', longText))
    expect(result.outputText).toContain('…')
  })
})
