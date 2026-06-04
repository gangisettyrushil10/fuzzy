import { randomUUID } from 'crypto'
import { getDb } from '../../services/dbService'
import type { AiActionType, AiResponseRecord, CreateAiResponseInput } from '@shared/types/database'

interface AiResponseRow {
  id: string
  document_id: string
  page_number: number | null
  action_type: string
  input_text: string
  context_text: string | null
  output_text: string
  model: string | null
  provider: string | null
  input_tokens: number | null
  output_tokens: number | null
  latency_ms: number | null
  cost_usd: number | null
  created_at: string
}

function toRecord(row: AiResponseRow): AiResponseRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    pageNumber: row.page_number,
    actionType: row.action_type as AiActionType,
    inputText: row.input_text,
    contextText: row.context_text,
    outputText: row.output_text,
    model: row.model,
    provider: row.provider,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    latencyMs: row.latency_ms,
    costUsd: row.cost_usd,
    createdAt: row.created_at
  }
}

export function insertAiResponse(input: CreateAiResponseInput): AiResponseRecord {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO ai_responses (
        id, document_id, page_number, action_type, input_text,
        context_text, output_text, model, provider, input_tokens,
        output_tokens, latency_ms, cost_usd, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.documentId,
      input.pageNumber,
      input.actionType,
      input.inputText,
      input.contextText,
      input.outputText,
      input.model,
      input.provider,
      input.inputTokens,
      input.outputTokens,
      input.latencyMs,
      input.costUsd,
      createdAt
    )
  return {
    id,
    documentId: input.documentId,
    pageNumber: input.pageNumber,
    actionType: input.actionType,
    inputText: input.inputText,
    contextText: input.contextText,
    outputText: input.outputText,
    model: input.model,
    provider: input.provider,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    latencyMs: input.latencyMs,
    costUsd: input.costUsd,
    createdAt
  }
}

export function listAiResponsesForDocument(documentId: string): AiResponseRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM ai_responses WHERE document_id = ? ORDER BY created_at DESC`)
    .all(documentId) as AiResponseRow[]
  return rows.map(toRecord)
}
