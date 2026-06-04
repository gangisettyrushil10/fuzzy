import { useEffect, useMemo } from 'react'
import type { AiActionType } from '@shared/types/database'
import { useSelectionStore } from '../../state/selectionStore'
import { useTutorStore } from '../../state/tutorStore'
import { usePdfStore } from '../../state/pdfStore'
import { useAppUiStore } from '../../state/appUiStore'
import { useOnboardingStore } from '../../state/onboardingStore'

interface ActionDef {
  id: AiActionType
  label: string
  hint: string
}

const ACTIONS: ActionDef[] = [
  { id: 'explain', label: 'Explain', hint: 'Plain explanation of this passage' },
  { id: 'simplify', label: 'Simplify', hint: 'Rewrite in simpler English' },
  { id: 'summarize', label: 'Summarize', hint: 'Tight summary of this passage' },
  { id: 'define', label: 'Define', hint: 'Define the selected term' },
  { id: 'example', label: 'Example', hint: 'Give a concrete example' },
  { id: 'quiz', label: 'Quiz me', hint: 'Practice questions from this passage' }
]

export function SelectionMenu(): React.JSX.Element | null {
  const selection = useSelectionStore((s) => s.selection)
  const clear = useSelectionStore((s) => s.clear)
  const runAction = useTutorStore((s) => s.runAction)
  const pageTexts = usePdfStore((s) => s.pageTexts)
  const registerDismiss = useAppUiStore((s) => s.registerDismissHandler)
  const advanceOnboarding = useOnboardingStore((s) => s.advance)

  useEffect(() => {
    return registerDismiss(() => clear())
  }, [registerDismiss, clear])

  // Position is derived from the current selection rect — purely a function
  // of `selection`, so a memo keeps it cheap without an effect.
  const pos = useMemo(() => {
    if (!selection) return null
    const PADDING = 8
    const ABOVE_OFFSET = 44
    const BELOW_OFFSET = 8
    const { top, bottom, left, right } = selection.anchorRect
    const midX = (left + right) / 2
    const fitsAbove = top > ABOVE_OFFSET + PADDING
    const placedTop = fitsAbove ? top - ABOVE_OFFSET : bottom + BELOW_OFFSET
    return { top: placedTop, left: midX }
  }, [selection])

  if (!selection || !pos) return null

  const handle = (action: AiActionType): void => {
    const context = pageTexts.get(selection.pageNumber) ?? null
    runAction(selection, action, context)
      .then(() => advanceOnboarding())
      .catch((err) => console.error('[fuzzy] runAction', err))
    clear()
  }

  return (
    <div
      role="toolbar"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: 'translate(-50%, 0)',
        zIndex: 50
      }}
      onMouseDown={(e) => {
        // Prevent the mousedown from collapsing the user's selection before
        // we read it.
        e.preventDefault()
      }}
      className="flex items-center gap-1 rounded-lg border border-fz-border bg-fz-surface-2/95 p-1 shadow-lg backdrop-blur"
    >
      {ACTIONS.map((a) => (
        <button
          key={a.id}
          type="button"
          title={a.hint}
          onClick={() => handle(a.id)}
          className="rounded px-2 py-1 text-[11px] text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg"
        >
          {a.label}
        </button>
      ))}
      <button
        type="button"
        title="Dismiss"
        onClick={() => clear()}
        className="ml-1 rounded px-1.5 py-1 text-[11px] text-fz-fg-subtle hover:text-fz-fg-muted"
      >
        ✕
      </button>
    </div>
  )
}
