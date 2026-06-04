import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AiActionType } from '@shared/types/database'
import { useAppUiStore } from '../../state/appUiStore'
import { useDocumentStore } from '../../state/documentStore'
import { useSelectionStore } from '../../state/selectionStore'
import { usePdfStore } from '../../state/pdfStore'
import { useTutorStore } from '../../state/tutorStore'

export interface CommandPaletteHandlers {
  onImport: () => void
  onOpenSettings: () => void
  onOpenReadingPlan: () => void
  onOpenStudyPack: () => void
  onGoToPage: (page: number) => void
}

interface CommandItem {
  id: string
  label: string
  hint?: string
  shortcut?: string
  disabled?: boolean
  disabledReason?: string
  run: () => void
}

export function CommandPalette({ handlers }: { handlers: CommandPaletteHandlers }): React.JSX.Element | null {
  const open = useAppUiStore((s) => s.commandPaletteOpen)
  const setOpen = useAppUiStore((s) => s.setCommandPaletteOpen)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const documents = useDocumentStore((s) => s.documents)
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const setActiveDocument = useDocumentStore((s) => s.setActiveDocument)
  const selection = useSelectionStore((s) => s.selection)
  const clearSelection = useSelectionStore((s) => s.clear)
  const pageCount = usePdfStore((s) => s.pageCount)
  const runAction = useTutorStore((s) => s.runAction)
  const pageTexts = usePdfStore((s) => s.pageTexts)

  const runAi = useCallback(
    (action: AiActionType) => {
      if (!selection) return
      const context = pageTexts.get(selection.pageNumber) ?? null
      runAction(selection, action, context).catch((err) => console.error('[fuzzy] runAction', err))
      clearSelection()
      setOpen(false)
    },
    [selection, pageTexts, runAction, clearSelection, setOpen]
  )

  const commands = useMemo((): CommandItem[] => {
    const hasDoc = Boolean(activeDocumentId)
    const hasSelection = Boolean(selection && selection.documentId === activeDocumentId)

    const list: CommandItem[] = [
      {
        id: 'import',
        label: 'Import PDF',
        shortcut: '⌘O',
        run: () => {
          handlers.onImport()
          setOpen(false)
        }
      },
      {
        id: 'settings',
        label: 'Open Settings',
        shortcut: '⌘,',
        run: () => {
          handlers.onOpenSettings()
          setOpen(false)
        }
      },
      {
        id: 'plan',
        label: 'Plan study session',
        shortcut: '⌘⇧P',
        disabled: !hasDoc,
        disabledReason: 'Open a document first',
        run: () => {
          handlers.onOpenReadingPlan()
          setOpen(false)
        }
      },
      {
        id: 'pack',
        label: 'Open study pack',
        shortcut: '⌘⇧S',
        disabled: !hasDoc,
        disabledReason: 'Open a document first',
        run: () => {
          handlers.onOpenStudyPack()
          setOpen(false)
        }
      },
      {
        id: 'goto',
        label: 'Go to page…',
        disabled: !hasDoc || pageCount === 0,
        disabledReason: 'Open a document first',
        run: () => {
          const raw = window.prompt(`Page number (1–${pageCount})`, '1')
          if (!raw) return
          const n = Number.parseInt(raw, 10)
          if (Number.isFinite(n) && n >= 1 && n <= pageCount) {
            handlers.onGoToPage(n)
          }
          setOpen(false)
        }
      },
      {
        id: 'explain',
        label: 'Explain current selection',
        disabled: !hasSelection,
        disabledReason: 'Select text in the document',
        run: () => runAi('explain')
      },
      {
        id: 'simplify',
        label: 'Simplify current selection',
        disabled: !hasSelection,
        disabledReason: 'Select text in the document',
        run: () => runAi('simplify')
      },
      {
        id: 'summarize',
        label: 'Summarize current selection',
        disabled: !hasSelection,
        disabledReason: 'Select text in the document',
        run: () => runAi('summarize')
      },
      {
        id: 'quiz',
        label: 'Quiz current selection',
        disabled: !hasSelection,
        disabledReason: 'Select text in the document',
        run: () => runAi('quiz')
      }
    ]

    for (const doc of documents.slice(0, 8)) {
      list.push({
        id: `doc:${doc.id}`,
        label: `Open: ${doc.title}`,
        run: () => {
          setActiveDocument(doc.id)
          setOpen(false)
        }
      })
    }

    return list
  }, [
    activeDocumentId,
    selection,
    documents,
    pageCount,
    handlers,
    runAi,
    setActiveDocument,
    setOpen
  ])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q))
  }, [commands, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setHighlight(0)
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    setHighlight(0)
  }, [query])

  if (!open) return null

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = filtered[highlight]
      if (item && !item.disabled) item.run()
    }
  }

  return (
    <div
      className="fz-modal-backdrop fixed inset-0 z-[100] flex items-start justify-center bg-black/50 pt-[18vh] backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="fz-palette-enter w-full max-w-lg overflow-hidden rounded-lg border border-fz-border bg-fz-surface-2 shadow-2xl"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-fz-border px-3 py-2">
          <span className="text-fz-fg-subtle" aria-hidden>
            ⌘K
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command…"
            className="min-w-0 flex-1 bg-transparent text-sm text-fz-fg outline-none placeholder:text-fz-fg-subtle"
            aria-label="Search commands"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto py-1" role="listbox">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-fz-fg-muted">No matching commands</li>
          ) : (
            filtered.map((item, i) => (
              <li key={item.id} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    if (!item.disabled) item.run()
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={[
                    'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm',
                    i === highlight ? 'bg-fz-accent-2/15 text-fz-fg' : 'text-fz-fg-muted',
                    item.disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-fz-bg'
                  ].join(' ')}
                  title={item.disabled ? item.disabledReason : undefined}
                >
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-fz-fg-subtle">
                      {item.shortcut}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
