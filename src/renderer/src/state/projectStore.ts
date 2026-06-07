import { create } from 'zustand'
import type {
  CitationFormat,
  ExportFormat,
  ProjectDetail,
  ProjectRecord,
  RankedPassage,
  SynthesisResult
} from '@shared/types/database'

// Durable research projects: a thesis + collected evidence + notes + saved
// syntheses. Source of truth for the Evidence Shelf (which used to be
// session-only in thesisStore). Active project id persists in localStorage.

const ACTIVE_KEY = 'fuzzy.activeProjectId'

// Stable key to tell whether a search result is already collected.
export function evidenceKey(p: {
  documentId: string
  pageNumber: number
  snippet: string
}): string {
  return `${p.documentId}:${p.pageNumber}:${p.snippet.slice(0, 60)}`
}

interface ProjectState {
  projects: ProjectRecord[]
  activeProjectId: string | null
  detail: ProjectDetail | null
  loading: boolean

  load: () => Promise<void>
  create: (title: string, thesis?: string) => Promise<ProjectRecord>
  setActive: (id: string | null) => Promise<void>
  rename: (id: string, title: string) => Promise<void>
  remove: (id: string) => Promise<void>
  refreshDetail: () => Promise<void>

  ensureActiveProject: (titleHint?: string) => Promise<string>
  addEvidence: (passage: RankedPassage) => Promise<void>
  removeEvidence: (id: string) => Promise<void>
  addNote: (content: string) => Promise<void>
  updateNote: (id: string, content: string) => Promise<void>
  removeNote: (id: string) => Promise<void>
  addSynthesis: (thesis: string, result: SynthesisResult) => Promise<void>
  exportActive: (format: CitationFormat, exportFormat: ExportFormat) => Promise<string | null>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  detail: null,
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      const projects = await window.fuzzy.projects.list()
      const stored = localStorage.getItem(ACTIVE_KEY)
      const active = stored && projects.some((p) => p.id === stored) ? stored : null
      set({ projects, activeProjectId: active, loading: false })
      if (active) await get().refreshDetail()
    } catch {
      set({ loading: false })
    }
  },

  create: async (title, thesis) => {
    const project = await window.fuzzy.projects.create(title, thesis)
    set({ projects: [project, ...get().projects] })
    await get().setActive(project.id)
    return project
  },

  setActive: async (id) => {
    set({ activeProjectId: id, detail: null })
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
    if (id) await get().refreshDetail()
  },

  rename: async (id, title) => {
    await window.fuzzy.projects.update(id, { title })
    set({
      projects: get().projects.map((p) => (p.id === id ? { ...p, title } : p))
    })
    if (get().activeProjectId === id) await get().refreshDetail()
  },

  remove: async (id) => {
    await window.fuzzy.projects.delete(id)
    const projects = get().projects.filter((p) => p.id !== id)
    set({ projects })
    if (get().activeProjectId === id) await get().setActive(projects[0]?.id ?? null)
  },

  refreshDetail: async () => {
    const id = get().activeProjectId
    if (!id) {
      set({ detail: null })
      return
    }
    const detail = await window.fuzzy.projects.getDetail(id)
    set({ detail })
  },

  ensureActiveProject: async (titleHint) => {
    const existing = get().activeProjectId
    if (existing) return existing
    const title = (titleHint?.trim().slice(0, 60) || 'My Research') as string
    const project = await get().create(title, titleHint ?? '')
    return project.id
  },

  addEvidence: async (passage) => {
    const projectId = await get().ensureActiveProject(passage.documentTitle)
    await window.fuzzy.projects.addEvidence(projectId, passage)
    await get().refreshDetail()
  },

  removeEvidence: async (id) => {
    await window.fuzzy.projects.removeEvidence(id)
    await get().refreshDetail()
  },

  addNote: async (content) => {
    const projectId = await get().ensureActiveProject()
    await window.fuzzy.projects.addNote(projectId, content)
    await get().refreshDetail()
  },

  updateNote: async (id, content) => {
    await window.fuzzy.projects.updateNote(id, content)
    await get().refreshDetail()
  },

  removeNote: async (id) => {
    await window.fuzzy.projects.removeNote(id)
    await get().refreshDetail()
  },

  addSynthesis: async (thesis, result) => {
    const projectId = await get().ensureActiveProject(thesis)
    await window.fuzzy.projects.addSynthesis(projectId, thesis, result)
    await get().refreshDetail()
  },

  exportActive: async (format, exportFormat) => {
    const id = get().activeProjectId
    if (!id) return null
    return window.fuzzy.projects.export(id, format, exportFormat)
  }
}))
