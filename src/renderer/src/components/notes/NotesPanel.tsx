import { useCallback, useEffect, useRef } from 'react'
import { useDocumentStore } from '../../state/documentStore'
import { useObsidianStore } from '../../state/obsidianStore'
import { Button } from '../ui'

const AUTOSAVE_DELAY_MS = 600

function saveLabel(state: 'idle' | 'saving' | 'saved' | 'error'): string {
  switch (state) {
    case 'saving':
      return 'Saving…'
    case 'saved':
      return 'Saved to Obsidian'
    case 'error':
      return 'Save failed'
    default:
      return ''
  }
}

// Freeform Markdown notes for the active document, written directly into the
// user's Obsidian vault (file-as-truth). Opening a document loads its `.md`
// file; edits autosave back. Obsidian edits show up on the next load.
export function NotesPanel(): React.JSX.Element {
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const status = useObsidianStore((s) => s.status)
  const content = useObsidianStore((s) => s.content)
  const loading = useObsidianStore((s) => s.loading)
  const saveState = useObsidianStore((s) => s.saveState)
  const loadStatus = useObsidianStore((s) => s.loadStatus)
  const loadFor = useObsidianStore((s) => s.loadFor)
  const clear = useObsidianStore((s) => s.clear)
  const pickVault = useObsidianStore((s) => s.pickVault)
  const setContent = useObsidianStore((s) => s.setContent)
  const save = useObsidianStore((s) => s.save)

  const connected = status?.connected ?? false

  const timer = useRef<number | null>(null)
  // Flush pending edits immediately, but only if there's something unsaved — so
  // merely viewing/switching doesn't rewrite the file (and clobber Obsidian).
  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    if (useObsidianStore.getState().saveState === 'saving') void save()
  }, [save])

  // Read status once so we know whether a vault is connected.
  useEffect(() => {
    if (!status) void loadStatus()
  }, [status, loadStatus])

  // (Re)load the note when the active document changes or the vault connects.
  // The cleanup flushes pending edits before switching — React runs it while the
  // store still holds the *previous* doc, so nothing is lost or misattributed.
  useEffect(() => {
    if (activeDocumentId) void loadFor(activeDocumentId)
    else clear()
    return () => flush()
  }, [activeDocumentId, connected, loadFor, clear, flush])

  const onChange = (text: string): void => {
    setContent(text)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      void save()
    }, AUTOSAVE_DELAY_MS)
  }

  if (!connected) {
    return (
      <div className="fz-selectable flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-fz-ui leading-relaxed text-fz-fg-muted">
          Take notes while you read and save them straight into your{' '}
          <span className="text-fz-fg">Obsidian vault</span> — no plugin needed.
        </p>
        <Button size="sm" variant="primary" onClick={() => void pickVault()}>
          Choose Obsidian vault…
        </Button>
        <p className="text-fz-micro text-fz-fg-subtle">
          Notes are written as Markdown into a Fuzzy folder inside the vault you pick.
        </p>
      </div>
    )
  }

  if (!activeDocumentId) {
    return (
      <div className="fz-selectable flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <p className="text-fz-ui leading-relaxed text-fz-fg-muted">
          Open a document to take notes on it.
        </p>
      </div>
    )
  }

  const vaultLabel = status ? `${status.vaultPath}/${status.subfolder}` : ''

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-7 shrink-0 items-center justify-between gap-2 border-b border-fz-border px-3">
        <span className="text-fz-micro font-semibold uppercase tracking-wider text-fz-fg-subtle">
          Notes
        </span>
        <span className="text-fz-micro text-fz-fg-subtle" aria-live="polite">
          {loading ? 'Loading…' : saveLabel(saveState)}
        </span>
      </div>

      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onBlur={flush}
        disabled={loading}
        placeholder="Write Markdown notes — they save straight into your Obsidian vault…"
        aria-label="Document notes"
        className="fz-selectable min-h-0 flex-1 resize-none bg-transparent px-3 py-3 text-fz-ui leading-relaxed text-fz-fg placeholder:text-fz-fg-subtle focus:outline-none disabled:opacity-60"
        spellCheck
      />

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-fz-border px-3 py-1.5 text-fz-micro text-fz-fg-subtle">
        <span className="truncate" title={vaultLabel}>
          {vaultLabel}
        </span>
        <button
          type="button"
          onClick={() => void pickVault()}
          className="shrink-0 hover:text-fz-fg focus-visible:ring-2 focus-visible:ring-fz-accent"
        >
          Change
        </button>
      </div>
    </div>
  )
}
