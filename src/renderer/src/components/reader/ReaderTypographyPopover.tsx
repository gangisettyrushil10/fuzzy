import { useEffect, useRef, useState } from 'react'
import { ReaderTypographyControls } from './ReaderTypographyControls'
import { cn } from '../../lib/cn'

// Kindle-style "Aa" quick-typography menu. Drops into both reader toolbars
// (PDF + reflowable). The trigger and panel share one relatively-positioned
// wrapper so the panel anchors under the button; closes on outside click or
// Escape. All controls write straight to readerPrefsStore (optimistic), so
// changes apply live to the open document.
export function ReaderTypographyPopover(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label="Reading appearance"
        aria-expanded={open}
        title="Reading appearance (font, size, theme)"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'rounded border px-2 py-0.5 text-[11px] transition',
          open
            ? 'border-fz-accent-2/60 bg-fz-accent-2/20 text-fz-accent'
            : 'border-fz-border text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg'
        )}
      >
        <span className="text-[13px] leading-none">A</span>
        <span className="text-[10px] leading-none">a</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Reading appearance"
          className="fz-palette-enter absolute right-0 top-full z-50 mt-1.5 max-h-[70vh] w-72 overflow-y-auto rounded-fz border border-fz-border bg-fz-elevated p-3 text-left shadow-fz-pop"
        >
          <ReaderTypographyControls />
        </div>
      )}
    </div>
  )
}
