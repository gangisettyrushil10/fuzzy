import { describe, expect, it, vi } from 'vitest'

// Mock the electron + repository module graph before importing the IPC file.
// We're testing the pure validator (`validateCreateAnnotationInput`), but
// importing the file pulls `ipcMain` and `insertAnnotation` through too —
// both of those need to be replaced with no-ops so the module evaluates.

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() }
}))

vi.mock('../src/main/db/repositories/annotationRepository', () => ({
  insertAnnotation: vi.fn(),
  deleteAnnotation: vi.fn()
}))

const { validateCreateAnnotationInput } = await import('../src/main/ipc/annotation.ipc')

function base(over: Record<string, unknown> = {}): unknown {
  return {
    documentId: 'doc-1',
    pageNumber: 3,
    selectedText: 'hello',
    note: 'a note',
    annotationType: 'user_note',
    color: 'purple',
    position: {
      pageNumber: 3,
      rectsOnPage: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05 }]
    },
    ...over
  }
}

describe('validateCreateAnnotationInput', () => {
  it('accepts a well-formed payload and passes through fields', () => {
    const out = validateCreateAnnotationInput(base())
    expect(out.documentId).toBe('doc-1')
    expect(out.pageNumber).toBe(3)
    expect(out.color).toBe('purple')
    expect(out.position?.rectsOnPage?.length).toBe(1)
  })

  it('truncates an oversized note instead of rejecting it', () => {
    const oversized = 'x'.repeat(8_001)
    const out = validateCreateAnnotationInput(base({ note: oversized }))
    expect(out.note.length).toBe(8_000)
  })

  it('truncates an oversized selectedText', () => {
    const oversized = 'y'.repeat(9_000)
    const out = validateCreateAnnotationInput(base({ selectedText: oversized }))
    expect(out.selectedText.length).toBe(8_000)
  })

  it('rejects a rect with a coordinate outside [0,1]', () => {
    const bad = base({
      position: {
        pageNumber: 3,
        rectsOnPage: [{ x: 0.1, y: 1.4, width: 0.2, height: 0.05 }]
      }
    })
    expect(() => validateCreateAnnotationInput(bad)).toThrow(
      /invalid annotation input: position\.rectsOnPage/
    )
  })

  it('rejects a missing required field', () => {
    expect(() => validateCreateAnnotationInput(base({ documentId: undefined }))).toThrow(
      /invalid annotation input: documentId/
    )
    expect(() => validateCreateAnnotationInput(base({ pageNumber: undefined }))).toThrow(
      /invalid annotation input: pageNumber/
    )
  })

  it('rejects an oversized rect array (> 200)', () => {
    const rects = Array.from({ length: 201 }, () => ({ x: 0, y: 0, width: 0.1, height: 0.1 }))
    const bad = base({ position: { pageNumber: 3, rectsOnPage: rects } })
    expect(() => validateCreateAnnotationInput(bad)).toThrow(
      /invalid annotation input: position\.rectsOnPage/
    )
  })

  it('rejects an unknown color', () => {
    expect(() => validateCreateAnnotationInput(base({ color: 'magenta' }))).toThrow(
      /invalid annotation input: color/
    )
  })

  it('rejects a non-positive pageNumber and out-of-range values', () => {
    expect(() => validateCreateAnnotationInput(base({ pageNumber: 0 }))).toThrow(
      /invalid annotation input: pageNumber/
    )
    expect(() => validateCreateAnnotationInput(base({ pageNumber: 1.5 }))).toThrow(
      /invalid annotation input: pageNumber/
    )
    expect(() => validateCreateAnnotationInput(base({ pageNumber: 100_001 }))).toThrow(
      /invalid annotation input: pageNumber/
    )
  })

  it('rejects a documentId longer than 64 chars', () => {
    expect(() => validateCreateAnnotationInput(base({ documentId: 'x'.repeat(65) }))).toThrow(
      /invalid annotation input: documentId/
    )
  })

  it('never echoes user input in the thrown error message', () => {
    const payload = base({ documentId: 'SECRET_LEAK_xxxxxx_user_string', pageNumber: -5 })
    try {
      validateCreateAnnotationInput(payload)
    } catch (err) {
      expect((err as Error).message).not.toContain('SECRET_LEAK')
    }
  })
})
