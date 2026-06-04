import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import { deleteAnnotation, insertAnnotation } from '../db/repositories/annotationRepository'
import {
  ANNOTATION_COLORS,
  type AnnotationColor,
  type AnnotationPosition,
  type AnnotationType,
  type CreateAnnotationInput
} from '@shared/types/database'

const MAX_DOCUMENT_ID_CHARS = 64
const MAX_PAGE_NUMBER = 100_000
const MAX_TEXT_CHARS = 8_000
const MAX_RECTS = 200

const VALID_ANNOTATION_TYPES: AnnotationType[] = ['highlight', 'ai_note', 'user_note']

function fail(field: string): never {
  // Field names are static identifiers we control — never user input. The
  // raw value is deliberately omitted to avoid echoing payload contents
  // back across the IPC boundary.
  throw new Error(`invalid annotation input: ${field}`)
}

function validateRect(value: unknown): { x: number; y: number; width: number; height: number } {
  if (!value || typeof value !== 'object') fail('position.rectsOnPage')
  const r = value as Record<string, unknown>
  for (const k of ['x', 'y', 'width', 'height'] as const) {
    const n = r[k]
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1) {
      fail('position.rectsOnPage')
    }
  }
  return {
    x: r.x as number,
    y: r.y as number,
    width: r.width as number,
    height: r.height as number
  }
}

// Hand-rolled validator (no zod / yup) for the annotation create payload.
// Mirrors the pattern in ai.ipc.ts: every assertion throws the same shaped
// Error and never leaks user-controlled strings back to the renderer.
export function validateCreateAnnotationInput(input: unknown): CreateAnnotationInput {
  if (!input || typeof input !== 'object') fail('payload')
  const r = input as Partial<CreateAnnotationInput>

  if (typeof r.documentId !== 'string' || r.documentId.length === 0) fail('documentId')
  if (r.documentId.length > MAX_DOCUMENT_ID_CHARS) fail('documentId')

  if (
    typeof r.pageNumber !== 'number' ||
    !Number.isInteger(r.pageNumber) ||
    r.pageNumber < 1 ||
    r.pageNumber > MAX_PAGE_NUMBER
  ) {
    fail('pageNumber')
  }

  if (typeof r.selectedText !== 'string') fail('selectedText')
  const selectedText =
    r.selectedText.length > MAX_TEXT_CHARS
      ? r.selectedText.slice(0, MAX_TEXT_CHARS)
      : r.selectedText

  if (typeof r.note !== 'string') fail('note')
  const note = r.note.length > MAX_TEXT_CHARS ? r.note.slice(0, MAX_TEXT_CHARS) : r.note

  if (!r.annotationType || !VALID_ANNOTATION_TYPES.includes(r.annotationType)) {
    fail('annotationType')
  }

  let color: AnnotationColor | null = null
  if (r.color !== undefined && r.color !== null) {
    if (
      typeof r.color !== 'string' ||
      !(ANNOTATION_COLORS as readonly string[]).includes(r.color)
    ) {
      fail('color')
    }
    color = r.color as AnnotationColor
  }

  let position: AnnotationPosition | null = null
  if (r.position !== undefined && r.position !== null) {
    if (typeof r.position !== 'object') fail('position')
    const p = r.position as Partial<AnnotationPosition>
    if (
      typeof p.pageNumber !== 'number' ||
      !Number.isInteger(p.pageNumber) ||
      p.pageNumber < 1 ||
      p.pageNumber > MAX_PAGE_NUMBER
    ) {
      fail('position.pageNumber')
    }
    let rects: AnnotationPosition['rectsOnPage'] | undefined
    if (p.rectsOnPage !== undefined) {
      if (!Array.isArray(p.rectsOnPage)) fail('position.rectsOnPage')
      if (p.rectsOnPage.length > MAX_RECTS) fail('position.rectsOnPage')
      rects = p.rectsOnPage.map(validateRect)
    }
    position = { pageNumber: p.pageNumber, ...(rects ? { rectsOnPage: rects } : {}) }
  }

  return {
    documentId: r.documentId,
    pageNumber: r.pageNumber,
    selectedText,
    note,
    annotationType: r.annotationType,
    color,
    position
  }
}

export function registerAnnotationIpc(): void {
  ipcMain.handle(IpcChannels.annotationsCreate, (_e, raw: unknown) => {
    const input = validateCreateAnnotationInput(raw)
    return insertAnnotation(input)
  })

  ipcMain.handle(IpcChannels.annotationsDelete, (_e, id: string) => {
    deleteAnnotation(id)
    return { ok: true as const }
  })
}
