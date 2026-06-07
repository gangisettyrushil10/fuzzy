import { create } from 'zustand'
import type {
  EssayOutline,
  EssayRecord,
  SynthesisEvidence,
  ThesisScope
} from '@shared/types/database'
import { useDocumentStore } from './documentStore'
import { usePdfStore } from './pdfStore'
import { useAppUiStore } from './appUiStore'
import { useReaderPrefsStore } from './readerPrefsStore'

// The Essay Workspace ("cursor for writing essays"): a thesis becomes an
// evidence-grounded outline (reusing the synthesis engine), each section drafts
// into a cited paragraph, and the whole thing compiles to Markdown — persisted.

type OutlineStatus = 'idle' | 'generating' | 'done' | 'error'

interface EssayState {
  essays: EssayRecord[]
  activeId: string | null
  title: string
  thesis: string
  scope: ThesisScope
  outline: EssayOutline | null
  outlineStatus: OutlineStatus
  draftingId: string | null // section id currently drafting
  error: string | null

  load: () => Promise<void>
  newEssay: () => Promise<void>
  open: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  setTitle: (title: string) => void
  setThesis: (thesis: string) => void
  setScope: (scope: ThesisScope) => void
  save: () => Promise<void>
  generateOutline: () => Promise<void>
  draftSection: (sectionId: string) => Promise<void>
  draftAll: () => Promise<void>
  compiledDraft: () => string
  showEvidence: (evidence: SynthesisEvidence) => void
}

function compile(title: string, outline: EssayOutline | null): string {
  if (!outline) return ''
  const body = outline.sections
    .map((s) => (s.draft && s.draft.trim() ? s.draft.trim() : s.point.trim()))
    .filter(Boolean)
    .join('\n\n')
  return `# ${title}\n\n${body}\n`
}

export const useEssayStore = create<EssayState>((set, get) => ({
  essays: [],
  activeId: null,
  title: 'Untitled essay',
  thesis: '',
  scope: 'library',
  outline: null,
  outlineStatus: 'idle',
  draftingId: null,
  error: null,

  load: async () => {
    const essays = await window.fuzzy.essays.list().catch(() => [])
    set({ essays })
  },

  newEssay: async () => {
    const essay = await window.fuzzy.essays.create('Untitled essay', '', 'library')
    set({
      essays: [essay, ...get().essays],
      activeId: essay.id,
      title: essay.title,
      thesis: essay.thesis,
      scope: essay.scope,
      outline: null,
      outlineStatus: 'idle',
      error: null
    })
  },

  open: async (id) => {
    const essay = await window.fuzzy.essays.get(id)
    if (!essay) return
    set({
      activeId: essay.id,
      title: essay.title,
      thesis: essay.thesis,
      scope: essay.scope,
      outline: essay.outline,
      outlineStatus: essay.outline ? 'done' : 'idle',
      error: null
    })
  },

  remove: async (id) => {
    await window.fuzzy.essays.delete(id)
    const essays = get().essays.filter((e) => e.id !== id)
    set({ essays })
    if (get().activeId === id) set({ activeId: null, outline: null, outlineStatus: 'idle' })
  },

  setTitle: (title) => set({ title }),
  setThesis: (thesis) => set({ thesis }),
  setScope: (scope) => set({ scope }),

  save: async () => {
    const { activeId, title, thesis, scope, outline } = get()
    if (!activeId) return
    const updated = await window.fuzzy.essays.update(activeId, {
      title,
      thesis,
      scope,
      outline,
      draftMd: compile(title, outline)
    })
    if (updated) {
      set({ essays: get().essays.map((e) => (e.id === updated.id ? updated : e)) })
    }
  },

  generateOutline: async () => {
    const { thesis, scope, activeId } = get()
    if (!thesis.trim()) return
    if (!activeId) await get().newEssay()
    const activeDocumentId = useDocumentStore.getState().activeDocumentId
    set({ outlineStatus: 'generating', error: null })
    try {
      const outline = await window.fuzzy.essays.generateOutline({ thesis, scope, activeDocumentId })
      set({ outline, outlineStatus: 'done' })
      await get().save()
    } catch (err) {
      set({ outlineStatus: 'error', error: err instanceof Error ? err.message : 'Outline failed' })
    }
  },

  draftSection: async (sectionId) => {
    const { outline, thesis } = get()
    if (!outline) return
    const section = outline.sections.find((s) => s.id === sectionId)
    if (!section) return
    const citationFormat = useReaderPrefsStore.getState().prefs.citationFormat
    set({ draftingId: sectionId })
    try {
      const draft = await window.fuzzy.essays.draftParagraph({ thesis, section, citationFormat })
      const next: EssayOutline = {
        ...outline,
        sections: outline.sections.map((s) => (s.id === sectionId ? { ...s, draft } : s))
      }
      set({ outline: next, draftingId: null })
      await get().save()
    } catch (err) {
      set({ draftingId: null, error: err instanceof Error ? err.message : 'Draft failed' })
    }
  },

  draftAll: async () => {
    const outline = get().outline
    if (!outline) return
    for (const section of outline.sections) {
      // eslint-disable-next-line no-await-in-loop -- sequential to keep token use + ordering sane
      await get().draftSection(section.id)
    }
  },

  compiledDraft: () => compile(get().title, get().outline),

  showEvidence: (evidence) => {
    const docStore = useDocumentStore.getState()
    if (docStore.activeDocumentId !== evidence.documentId) {
      docStore.setActiveDocument(evidence.documentId)
    }
    usePdfStore.getState().setPage(evidence.pageNumber)
    useAppUiStore.getState().requestPassageHighlight({
      documentId: evidence.documentId,
      pageNumber: evidence.pageNumber,
      snippet: evidence.quote
    })
    useAppUiStore.getState().setEssayOpen(false)
  }
}))
