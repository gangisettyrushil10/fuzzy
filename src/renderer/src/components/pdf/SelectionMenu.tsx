import { useEffect, useMemo } from 'react'
import type { AiActionType } from '@shared/types/database'
import { useSelectionStore } from '../../state/selectionStore'
import { useTutorStore } from '../../state/tutorStore'
import { usePdfStore } from '../../state/pdfStore'
import { useAppUiStore } from '../../state/appUiStore'
import { useOnboardingStore } from '../../state/onboardingStore'
import { useDocumentStore } from '../../state/documentStore'
import { useShareCardStore } from '../../state/shareCardStore'
import { Button, IconButton } from '../ui'

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
  const documents = useDocumentStore((s) => s.documents)
  const openShare = useShareCardStore((s) => s.openShare)

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
    const context = selection.contextText ?? pageTexts.get(selection.pageNumber) ?? null
    runAction(selection, action, context)
      .then(() => advanceOnboarding())
      .catch((err) => console.error('[fuzzy] runAction', err))
    clear()
  }

  // Not an AI action — skip runAction/ai_responses persistence entirely and
  // just hand the excerpt to the share-card modal.
  const handleShare = (): void => {
    const doc = documents.find((d) => d.id === selection.documentId)
    openShare({
      excerptText: selection.text,
      sourceTitle: doc?.title ?? 'Untitled',
      sourceAuthor: doc?.author ?? null,
      pageNumber: selection.pageNumber
    })
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
      className="flex items-center gap-0.5 rounded-lg border border-fz-border bg-fz-elevated/95 p-1 shadow-fz-pop backdrop-blur"
    >
      {ACTIONS.map((a) => (
        <Button
          key={a.id}
          variant="ghost"
          size="sm"
          title={a.hint}
          onClick={() => handle(a.id)}
        >
          {a.label}
        </Button>
      ))}
      <Button variant="ghost" size="sm" title="Share this excerpt" onClick={handleShare}>
        Share
      </Button>
      <IconButton aria-label="Dismiss" variant="ghost" size="sm" onClick={() => clear()}>
        ✕
      </IconButton>
    </div>
  )
}
