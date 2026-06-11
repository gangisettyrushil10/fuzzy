import { useRef, useState } from 'react'
import type { EntityRecord } from '@shared/types/database'
import { useDocumentStore } from '../../state/documentStore'
import { useEvidenceStore } from '../../state/evidenceStore'
import { usePdfStore } from '../../state/pdfStore'
import { useDocumentEntities } from '../../hooks/useDocumentEntities'

// The document's detected characters (the entity index). Clicking a name drops
// it into the evidence query (build "Elizabeth and Darcy"); the page chip cycles
// through that character's appearances so you can track them through the book.
export function CastSection(): React.JSX.Element | null {
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const query = useEvidenceStore((s) => s.query)
  const setQuery = useEvidenceStore((s) => s.setQuery)
  const setPage = usePdfStore((s) => s.setPage)

  const [refreshKey, setRefreshKey] = useState(0)
  const entities = useDocumentEntities(activeDocumentId, refreshKey)
  const [open, setOpen] = useState(true)
  const [refining, setRefining] = useState(false)
  // Per-entity appearance cursor + cached mention pages (lazy-loaded).
  const cursors = useRef<Map<string, number>>(new Map())
  const mentions = useRef<Map<string, number[]>>(new Map())

  if (!activeDocumentId || entities.length === 0) return null

  // AI-refine: drop non-people (spells/places/objects) the offline pass let in.
  const refineCast = async (): Promise<void> => {
    if (refining) return
    setRefining(true)
    try {
      await window.fuzzy.entities.rebuild(activeDocumentId)
      cursors.current.clear()
      mentions.current.clear()
      setRefreshKey((k) => k + 1)
    } catch {
      /* keep the existing roster on failure */
    } finally {
      setRefining(false)
    }
  }

  const appendToQuery = (name: string): void => {
    const trimmed = query.trim()
    if (trimmed.toLowerCase().includes(name.toLowerCase())) return
    setQuery(trimmed ? `${trimmed} ${name}` : name)
  }

  const cycleAppearance = async (entity: EntityRecord): Promise<void> => {
    let pages = mentions.current.get(entity.id)
    if (!pages) {
      pages = await window.fuzzy.entities.mentions(entity.id).catch(() => [] as number[])
      mentions.current.set(entity.id, pages)
    }
    if (pages.length === 0) {
      if (entity.firstPage) setPage(entity.firstPage)
      return
    }
    const cursor = cursors.current.get(entity.id) ?? 0
    setPage(pages[cursor % pages.length])
    cursors.current.set(entity.id, cursor + 1)
  }

  return (
    <div className="rounded-fz border border-fz-border bg-fz-bg/40 p-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-fz-label font-semibold uppercase tracking-wider text-fz-accent transition hover:text-fz-fg"
        >
          {open ? '▾' : '▸'} Cast · {entities.length}
        </button>
        <button
          type="button"
          onClick={() => void refineCast()}
          disabled={refining}
          title="Use AI to drop non-characters (spells, places, objects) from the cast"
          className="text-fz-micro text-fz-fg-subtle transition hover:text-fz-accent disabled:opacity-50"
        >
          {refining ? 'Refining…' : '✦ Refine'}
        </button>
      </div>
      {open && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {entities.map((e) => (
            <li key={e.id} className="flex items-center rounded-full border border-fz-border bg-fz-surface">
              <button
                type="button"
                onClick={() => appendToQuery(e.name)}
                title={`Add “${e.name}” to the query`}
                className="rounded-l-full px-2 py-0.5 text-fz-micro text-fz-fg-muted transition hover:bg-fz-bg hover:text-fz-fg"
              >
                {e.name}
                <span className="ml-1 text-fz-fg-subtle">{e.mentionCount}</span>
              </button>
              <button
                type="button"
                onClick={() => void cycleAppearance(e)}
                title="Jump through this character's appearances"
                className="rounded-r-full border-l border-fz-border px-1.5 py-0.5 text-fz-micro text-fz-accent transition hover:bg-fz-bg"
              >
                ↗
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
