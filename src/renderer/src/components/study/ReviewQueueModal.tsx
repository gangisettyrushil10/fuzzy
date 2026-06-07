import { useEffect, useState } from 'react'
import { Modal } from '../ui'
import { cn } from '../../lib/cn'
import { useFlashcardReviewStore } from '../../state/flashcardReviewStore'
import type { DueCard, ReviewGrade } from '@shared/types/database'

const GRADE_BUTTONS: Array<{ grade: ReviewGrade; label: string; cls: string }> = [
  { grade: 'again', label: 'Again', cls: 'border-fz-danger/50 text-fz-danger hover:bg-fz-danger/10' },
  { grade: 'hard', label: 'Hard', cls: 'border-fz-border text-fz-fg-muted hover:bg-fz-bg' },
  { grade: 'good', label: 'Good', cls: 'border-fz-border text-fz-fg-muted hover:bg-fz-bg' },
  {
    grade: 'easy',
    label: 'Easy',
    cls: 'border-fz-accent-2/60 bg-fz-accent-2/15 text-fz-fg hover:bg-fz-accent-2/30'
  }
]

function CardFront({ card }: { card: DueCard['card'] }): React.JSX.Element {
  return (
    <div className="text-fz-fg">
      {card.kind === 'cloze' && (
        <span className="mr-1.5 rounded bg-fz-accent-2/20 px-1 py-0.5 text-[10px] uppercase tracking-wider text-fz-fg-subtle">
          cloze
        </span>
      )}
      {card.question}
    </div>
  )
}

// Cross-document spaced-repetition review. Steps through every card due now,
// regardless of which document it came from.
export function ReviewQueueModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const dueCards = useFlashcardReviewStore((s) => s.dueCards)
  const loadDue = useFlashcardReviewStore((s) => s.loadDue)
  const grade = useFlashcardReviewStore((s) => s.grade)
  const [revealed, setRevealed] = useState(false)
  const [reviewed, setReviewed] = useState(0)

  useEffect(() => {
    void loadDue()
  }, [loadDue])

  // grade() drops the card from the front of the queue, so the next due card is
  // always dueCards[0].
  const card = dueCards[0]

  const handleGrade = (g: ReviewGrade): void => {
    if (!card) return
    void grade(card, g)
    setReviewed((n) => n + 1)
    setRevealed(false)
  }

  return (
    <Modal
      title="Review due"
      description="Spaced-repetition flashcards from every document, due now."
      size="md"
      onClose={onClose}
    >
      {!card ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="text-fz-title font-semibold text-fz-fg">All caught up</div>
          <p className="text-fz-ui text-fz-fg-muted">
            {reviewed > 0
              ? `You reviewed ${reviewed} card${reviewed === 1 ? '' : 's'}. Nothing else is due.`
              : 'No cards are due right now. Generate a study pack and study its flashcards to start a review schedule.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="mb-2 flex items-center justify-between text-fz-micro text-fz-fg-subtle">
            <span className="truncate" title={card.documentTitle}>
              {card.documentTitle}
            </span>
            <span>{dueCards.length} due</span>
          </div>
          <div className="flex min-h-[140px] flex-col justify-center rounded-lg border border-fz-border bg-fz-bg/40 p-6">
            <CardFront card={card.card} />
            {revealed && (
              <div className="mt-4 border-t border-fz-border pt-4 text-fz-fg-muted">
                {card.card.answer}
              </div>
            )}
          </div>
          <div className="mt-3">
            {!revealed ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="w-full rounded border border-fz-border bg-fz-bg/40 py-2 text-fz-ui text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg"
              >
                Show answer
              </button>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {GRADE_BUTTONS.map((g) => (
                  <button
                    key={g.grade}
                    type="button"
                    onClick={() => handleGrade(g.grade)}
                    className={cn('rounded border py-2 text-fz-ui transition', g.cls)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
