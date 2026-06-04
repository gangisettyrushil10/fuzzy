import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import {
  insertAiResponse,
  listAiResponsesForDocument
} from '../db/repositories/aiResponseRepository'
import { runAiAction, SanitizedOpenAiError } from '../services/ai/provider'
import type { AiActionRequest, AiActionType } from '@shared/types/database'

const VALID_ACTIONS: AiActionType[] = [
  'explain',
  'simplify',
  'summarize',
  'define',
  'example',
  'quiz'
]

const MAX_SELECTED_TEXT_CHARS = 8_000
const MAX_CONTEXT_TEXT_CHARS = 12_000

function validateRequest(input: unknown): AiActionRequest {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid AI action request.')
  }
  const r = input as Partial<AiActionRequest>
  if (typeof r.documentId !== 'string' || !r.documentId) {
    throw new Error('documentId is required.')
  }
  if (typeof r.pageNumber !== 'number' || r.pageNumber < 1) {
    throw new Error('pageNumber must be >= 1.')
  }
  if (typeof r.selectedText !== 'string' || !r.selectedText.trim()) {
    throw new Error('selectedText is required.')
  }
  if (r.selectedText.length > MAX_SELECTED_TEXT_CHARS) {
    throw new Error(`selectedText is too long (max ${MAX_SELECTED_TEXT_CHARS} chars).`)
  }
  if (!r.action || !VALID_ACTIONS.includes(r.action)) {
    throw new Error(`action must be one of: ${VALID_ACTIONS.join(', ')}.`)
  }
  let contextText: string | null = null
  if (typeof r.contextText === 'string') {
    // Hard cap on context length to keep token spend predictable and to
    // shrink the prompt-injection surface area from a hostile PDF page.
    contextText =
      r.contextText.length > MAX_CONTEXT_TEXT_CHARS
        ? r.contextText.slice(0, MAX_CONTEXT_TEXT_CHARS)
        : r.contextText
  }
  let conversationHistory: AiActionRequest['conversationHistory']
  if (Array.isArray(r.conversationHistory)) {
    conversationHistory = r.conversationHistory
      .filter(
        (t): t is { role: 'user' | 'assistant'; content: string } =>
          !!t &&
          typeof t === 'object' &&
          (t.role === 'user' || t.role === 'assistant') &&
          typeof (t as { content?: string }).content === 'string'
      )
      .slice(-6)
      .map((t) => ({
        role: t.role,
        content: (t.content as string).slice(0, 4_000)
      }))
  }

  let followUpText: string | null = null
  if (typeof r.followUpText === 'string' && r.followUpText.trim()) {
    followUpText = r.followUpText.trim().slice(0, 2_000)
  }

  return {
    documentId: r.documentId,
    pageNumber: r.pageNumber,
    selectedText: r.selectedText,
    action: r.action,
    contextText,
    conversationHistory,
    followUpText
  }
}

export function registerAiIpc(): void {
  ipcMain.handle(IpcChannels.aiResponsesListForDocument, (_e, documentId: string) =>
    listAiResponsesForDocument(documentId)
  )

  ipcMain.handle(IpcChannels.aiRunAction, async (_e, raw: unknown) => {
    const request = validateRequest(raw)
    try {
      const result = await runAiAction(request)
      insertAiResponse({
        documentId: request.documentId,
        pageNumber: request.pageNumber,
        actionType: request.action,
        inputText: request.selectedText,
        contextText: request.contextText,
        outputText: result.outputText,
        model: result.model,
        provider: result.provider,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs: result.latencyMs,
        // Cost calc is left null for now — pricing varies by model and
        // shifts often; capture it later via a settings-driven table.
        costUsd: null
      })
      return result
    } catch (err) {
      if (err instanceof SanitizedOpenAiError) {
        // Throw a fresh Error so the SanitizedOpenAiError constructor doesn't
        // get stringified with its private fields. Renderer receives a clean
        // message via Electron's error-cloning.
        throw new Error(err.message)
      }
      throw err
    }
  })
}
