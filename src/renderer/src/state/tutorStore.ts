import { create } from 'zustand'
import type { AiActionResult, AiActionType, AnnotationRecord } from '@shared/types/database'
import type { NormalizedRect, PdfSelection } from './selectionStore'
import { useAnnotationStore } from './annotationStore'
import { useObsidianStore } from './obsidianStore'
import { buildAiNoteBlock } from '@shared/obsidian'

interface TutorRequest {
  documentId: string
  pageNumber: number
  action: AiActionType
  selectedText: string
  rectsOnPage: NormalizedRect[]
  contextText: string | null
  startedAt: number
}

export interface TutorMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  action?: AiActionType
}

interface TutorState {
  status: 'idle' | 'loading' | 'success' | 'error'
  request: TutorRequest | null
  result: AiActionResult | null
  messages: TutorMessage[]
  error: string | null
  errorCode: 'auth' | 'network' | 'generic' | null
  savedAnnotationId: string | null
  followUpDraft: string
  saveToast: boolean

  runAction: (
    selection: PdfSelection,
    action: AiActionType,
    context: string | null
  ) => Promise<void>
  regenerate: () => Promise<void>
  askFollowUp: (question: string) => Promise<void>
  openFromAnnotation: (ann: AnnotationRecord) => void
  saveAsNote: () => Promise<void>
  setFollowUpDraft: (text: string) => void
  clearSaveToast: () => void
  clear: () => void
}

const ACTION_LABEL: Record<AiActionType, string> = {
  explain: 'Explain',
  simplify: 'Simplify',
  summarize: 'Summarize',
  define: 'Define',
  example: 'Give example',
  quiz: 'Quiz me',
  why_it_matters: 'Why it matters',
  margin_note: 'Margin note'
}

function classifyErrorMessage(message: string): TutorState['errorCode'] {
  const m = message.toLowerCase()
  if (m.includes('key') || m.includes('settings') || m.includes('rejected')) return 'auth'
  if (m.includes('internet') || m.includes('reach') || m.includes('network')) return 'network'
  return 'generic'
}

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useTutorStore = create<TutorState>((set, get) => ({
  status: 'idle',
  request: null,
  result: null,
  messages: [],
  error: null,
  errorCode: null,
  savedAnnotationId: null,
  followUpDraft: '',
  saveToast: false,

  runAction: async (selection, action, context) => {
    const request: TutorRequest = {
      documentId: selection.documentId,
      pageNumber: selection.pageNumber,
      action,
      selectedText: selection.text,
      rectsOnPage: selection.rectsOnPage,
      contextText: context,
      startedAt: Date.now()
    }
    set({
      status: 'loading',
      request,
      result: null,
      messages: [],
      error: null,
      errorCode: null,
      savedAnnotationId: null,
      followUpDraft: '',
      saveToast: false
    })

    try {
      const result = await window.fuzzy.ai.runAction({
        documentId: selection.documentId,
        pageNumber: selection.pageNumber,
        action,
        selectedText: selection.text,
        contextText: context
      })
      if (get().request?.startedAt !== request.startedAt) return
      set({
        status: 'success',
        result,
        messages: [{ id: nextId(), role: 'assistant', content: result.outputText, action }]
      })
    } catch (err) {
      if (get().request?.startedAt !== request.startedAt) return
      const message = err instanceof Error ? err.message : 'AI action failed'
      set({
        status: 'error',
        error: message,
        errorCode: classifyErrorMessage(message)
      })
    }
  },

  regenerate: async () => {
    const { request } = get()
    if (!request) return
    const pseudoSelection: PdfSelection = {
      documentId: request.documentId,
      pageNumber: request.pageNumber,
      text: request.selectedText,
      anchorRect: { top: 0, left: 0, bottom: 0, right: 0 },
      rectsOnPage: request.rectsOnPage
    }
    await get().runAction(pseudoSelection, request.action, request.contextText)
  },

  askFollowUp: async (question) => {
    const { request, messages, result } = get()
    if (!request || !question.trim()) return
    const trimmed = question.trim()
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    const userMsg: TutorMessage = { id: nextId(), role: 'user', content: trimmed }
    set({
      status: 'loading',
      error: null,
      errorCode: null,
      messages: [...messages, userMsg],
      followUpDraft: ''
    })

    const startedAt = Date.now()
    try {
      const next = await window.fuzzy.ai.runAction({
        documentId: request.documentId,
        pageNumber: request.pageNumber,
        action: request.action,
        selectedText: request.selectedText,
        contextText: request.contextText,
        conversationHistory: history,
        followUpText: trimmed
      })
      if (get().request?.startedAt !== request.startedAt) return
      set({
        status: 'success',
        result: next,
        messages: [
          ...get().messages,
          { id: nextId(), role: 'assistant', content: next.outputText, action: request.action }
        ]
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Follow-up failed'
      set({
        status: 'error',
        error: message,
        errorCode: classifyErrorMessage(message),
        result
      })
    }
    void startedAt
  },

  openFromAnnotation: (ann) => {
    set({
      status: 'success',
      request: {
        documentId: ann.documentId,
        pageNumber: ann.pageNumber ?? 1,
        action: 'explain',
        selectedText: ann.selectedText,
        rectsOnPage: ann.position?.rectsOnPage ?? [],
        contextText: null,
        startedAt: Date.now()
      },
      result: {
        outputText: ann.note,
        model: 'saved-note',
        provider: 'mock',
        inputTokens: null,
        outputTokens: null,
        latencyMs: 0,
        fallbackReason: null
      },
      messages: [{ id: nextId(), role: 'assistant', content: ann.note, action: 'explain' }],
      error: null,
      errorCode: null,
      savedAnnotationId: ann.id
    })
  },

  saveAsNote: async () => {
    const { request, result, savedAnnotationId } = get()
    if (!request || !result || savedAnnotationId) return
    const note = result.outputText
    const ann = await window.fuzzy.annotations.create({
      documentId: request.documentId,
      pageNumber: request.pageNumber,
      selectedText: request.selectedText,
      note,
      annotationType: 'ai_note',
      color: null,
      position: {
        pageNumber: request.pageNumber,
        rectsOnPage: request.rectsOnPage.length > 0 ? request.rectsOnPage : undefined
      }
    })
    set({ savedAnnotationId: ann.id, saveToast: true })
    useAnnotationStore.getState().add(ann)
    // Mirror the saved answer into the document's Obsidian note when a vault is
    // configured. Fire-and-forget: a vault hiccup must never fail the save.
    if (useObsidianStore.getState().status?.connected) {
      window.fuzzy.obsidian
        .appendNote(
          request.documentId,
          buildAiNoteBlock({
            text: note,
            selectedText: request.selectedText,
            pageNumber: request.pageNumber
          })
        )
        .catch((err) => console.error('[fuzzy] mirror AI note to Obsidian failed', err))
    }
    window.setTimeout(() => get().clearSaveToast(), 2200)
  },

  setFollowUpDraft: (text) => set({ followUpDraft: text }),
  clearSaveToast: () => set({ saveToast: false }),

  clear: () =>
    set({
      status: 'idle',
      request: null,
      result: null,
      messages: [],
      error: null,
      errorCode: null,
      savedAnnotationId: null,
      followUpDraft: '',
      saveToast: false
    })
}))

export function actionLabel(action: AiActionType): string {
  return ACTION_LABEL[action] ?? action
}

export function tutorProviderLabel(result: AiActionResult | null): string {
  if (!result) return ''
  if (result.fallbackReason === 'no_api_key') return 'Mock (no API key)'
  if (result.provider === 'mock') return 'Mock'
  return `OpenAI · ${result.model}`
}
