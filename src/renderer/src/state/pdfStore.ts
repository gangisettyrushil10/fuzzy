import { create } from 'zustand'
import { getDocument } from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { ensurePdfjsWorker } from '../lib/pdfjs'
import { useDocumentStore } from './documentStore'

interface PdfState {
  documentId: string | null
  doc: PDFDocumentProxy | null
  pageCount: number
  currentPage: number
  scale: number
  loading: boolean
  error: string | null
  // Cached extracted text by page number (1-indexed). Filled lazily as
  // pages render so AI requests can include nearby context cheaply.
  pageTexts: Map<number, string>
  // Per-page persistence flag. As soon as a page's text has been shipped
  // to main and written into `pages`, we mark it so we don't double-write.
  persistedPages: Set<number>
  // Monotonic counter for loadForDocument calls. Each call snapshots the
  // value of `loadToken` it was issued under, and any async resolution
  // bails before mutating state if a newer call has bumped the token.
  // This prevents a slow load of doc A from clobbering the UI after the
  // user already switched to doc B.
  loadToken: number
  // High-water mark: the furthest page reached in this session (or restored
  // from DB). Never decreases. This is what spoiler-safe mode uses so that
  // jumping back to re-read an earlier chapter doesn't shrink the boundary.
  highWaterMark: number

  loadForDocument: (documentId: string) => Promise<void>
  unload: () => void
  setPage: (page: number) => void
  setScale: (scale: number) => void
  setPageText: (pageNumber: number, text: string) => void
  markPagePersisted: (pageNumber: number) => void
  isPagePersisted: (pageNumber: number) => boolean
}

// Debounce timer for persisting the high-water mark to the DB. Module-level so
// it survives re-renders without needing a ref.
let _hwmPersistTimer: ReturnType<typeof setTimeout> | null = null

function scheduleHwmPersist(documentId: string, page: number): void {
  if (_hwmPersistTimer) clearTimeout(_hwmPersistTimer)
  _hwmPersistTimer = setTimeout(() => {
    _hwmPersistTimer = null
    window.fuzzy.documents.setLastReadPage(documentId, page).catch(() => undefined)
  }, 1500)
}

export const usePdfStore = create<PdfState>((set, get) => ({
  documentId: null,
  doc: null,
  pageCount: 0,
  currentPage: 1,
  scale: 1.25,
  loading: false,
  error: null,
  pageTexts: new Map(),
  persistedPages: new Set(),
  loadToken: 0,
  highWaterMark: 1,

  loadForDocument: async (documentId) => {
    if (get().documentId === documentId && get().doc) return
    ensurePdfjsWorker()

    // Look up the persisted high-water mark before tearing down the old doc so
    // we can restore position without an extra IPC round-trip.
    const docRecord = useDocumentStore.getState().documents.find((d) => d.id === documentId)
    const resumePage = docRecord?.lastReadPage ?? 1

    // Tear down the previous doc cleanly, then issue a fresh load token.
    const prev = get().doc
    if (prev) {
      prev.destroy().catch(() => undefined)
    }
    const myToken = get().loadToken + 1
    set({
      documentId,
      doc: null,
      pageCount: 0,
      currentPage: resumePage,
      highWaterMark: resumePage,
      loading: true,
      error: null,
      pageTexts: new Map(),
      persistedPages: new Set(),
      loadToken: myToken
    })

    // Helper: any mutation after an `await` goes through this so a
    // superseded load can't smear partial state onto the active doc.
    const stillCurrent = (): boolean =>
      get().loadToken === myToken && get().documentId === documentId

    try {
      const bytes = await window.fuzzy.documents.readFile(documentId)
      if (!stillCurrent()) return
      if (!bytes) {
        set({ loading: false, error: 'Could not read document file.' })
        return
      }
      const data = new Uint8Array(bytes)
      const task = getDocument({ data })
      const doc = await task.promise
      if (!stillCurrent()) {
        // A newer load won the race. Don't leak this doc proxy.
        doc.destroy().catch(() => undefined)
        return
      }
      const clampedResume = Math.min(Math.max(resumePage, 1), doc.numPages)
      set({ doc, pageCount: doc.numPages, currentPage: clampedResume, loading: false })
    } catch (err) {
      if (!stillCurrent()) return
      console.error('[fuzzy pdf] load failed', err)
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to open PDF'
      })
    }
  },

  unload: () => {
    const prev = get().doc
    if (prev) prev.destroy().catch(() => undefined)
    set({
      documentId: null,
      doc: null,
      pageCount: 0,
      currentPage: 1,
      highWaterMark: 1,
      loading: false,
      error: null,
      pageTexts: new Map(),
      persistedPages: new Set(),
      // Bump the token so any in-flight load knows it was superseded.
      loadToken: get().loadToken + 1
    })
  },

  setPage: (page) => {
    const { pageCount, documentId, highWaterMark } = get()
    if (pageCount === 0) return
    const clamped = Math.min(Math.max(page, 1), pageCount)
    if (clamped > highWaterMark) {
      set({ currentPage: clamped, highWaterMark: clamped })
      if (documentId) scheduleHwmPersist(documentId, clamped)
    } else {
      set({ currentPage: clamped })
    }
  },

  setScale: (scale) => {
    const next = Math.min(Math.max(scale, 0.5), 3)
    set({ scale: next })
  },

  setPageText: (pageNumber, text) => {
    const next = new Map(get().pageTexts)
    next.set(pageNumber, text)
    set({ pageTexts: next })
  },

  markPagePersisted: (pageNumber) => {
    const next = new Set(get().persistedPages)
    next.add(pageNumber)
    set({ persistedPages: next })
  },

  isPagePersisted: (pageNumber) => get().persistedPages.has(pageNumber)
}))
