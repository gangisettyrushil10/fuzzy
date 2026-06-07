import { useEffect, useRef, useState } from 'react'
import { useComplexityStore, type DefinitionTarget } from '../../state/complexityStore'
import { lookupGloss } from '../../lib/offlineDictionary'
import { useTypewriter } from '../../hooks/useTypewriter'
import { Spinner } from '../ui'

// Lightweight inline definition popover for a clicked complex word. Shows an
// instant offline gloss (if known), then reveals the mocked "define" answer
// underneath with a typewriter. Mounted once in AppShell; reads the active
// target from complexityStore.
export function WordDefinitionPopover(): React.JSX.Element | null {
  const target = useComplexityStore((s) => s.popover)
  const close = useComplexityStore((s) => s.closePopover)
  if (!target) return null
  return <PopoverInner key={`${target.documentId}:${target.pageNumber}:${target.word}`} target={target} onClose={close} />
}

function PopoverInner({
  target,
  onClose
}: {
  target: DefinitionTarget
  onClose: () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [definition, setDefinition] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const gloss = lookupGloss(target.word)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setDefinition(null)
    window.fuzzy.ai
      .runAction({
        documentId: target.documentId,
        pageNumber: target.pageNumber,
        action: 'define',
        selectedText: target.word,
        contextText: target.contextText
      })
      .then((r) => {
        if (cancelled) return
        setDefinition(r.outputText)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [target])

  // Close on outside click or Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const { display } = useTypewriter({
    id: `def:${target.documentId}:${target.pageNumber}:${target.word}`,
    text: definition ?? '',
    enabled: !!definition
  })

  // Anchor below the word, clamped to the viewport width.
  const width = 300
  const left = Math.min(Math.max(target.anchor.left, 8), window.innerWidth - width - 8)
  const top = target.anchor.bottom + 8

  return (
    <div
      ref={ref}
      role="dialog"
      className="fz-palette-enter fixed z-[55] rounded-fz border border-fz-border bg-fz-elevated p-3 shadow-fz-pop"
      style={{ left, top, width }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-fz-body font-semibold text-fz-fg">{target.word}</span>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="text-fz-fg-subtle transition hover:text-fz-fg"
        >
          ✕
        </button>
      </div>
      {gloss && <p className="mb-2 text-fz-ui leading-relaxed text-fz-fg-muted">{gloss}</p>}
      <div className="border-t border-fz-border pt-2">
        <span className="mb-1 block text-fz-micro font-semibold uppercase tracking-wider text-fz-fg-subtle">
          Definition
        </span>
        {loading && !definition ? (
          <span className="flex items-center gap-2 text-fz-ui text-fz-fg-muted">
            <Spinner size={12} /> Looking it up…
          </span>
        ) : (
          <p className="whitespace-pre-wrap text-fz-ui leading-relaxed text-fz-fg">{display}</p>
        )}
      </div>
    </div>
  )
}
