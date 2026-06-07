import type { CitationFormat, RankedPassage } from '@shared/types/database'
import { Button, Card } from '../ui'
import { toast } from '../../state/toastStore'

// One ranked evidence quote: the passage, its source + page, a relevance bar,
// the citation in the selected format, and actions (copy / jump to source).
// Staggered fade-in (animation-delay by index) so results "stream" in.
export function ThesisResultCard({
  passage,
  index,
  citationFormat,
  saved,
  onShowInPage,
  onSave
}: {
  passage: RankedPassage
  index: number
  citationFormat: CitationFormat
  saved: boolean
  onShowInPage: (passage: RankedPassage) => void
  onSave: (passage: RankedPassage) => void
}): React.JSX.Element {
  const citation = passage.citations[citationFormat]
  const relevance = Math.round(passage.score * 100)

  const copyCitation = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(citation)
      toast.success('Citation copied')
    } catch {
      toast.error('Could not copy citation')
    }
  }

  return (
    <Card
      className="fz-palette-enter space-y-2 p-3"
      style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
    >
      {/* Relevance */}
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-fz-border">
          <div className="h-full rounded-full bg-fz-accent-2" style={{ width: `${relevance}%` }} />
        </div>
        <span className="text-fz-micro tabular-nums text-fz-fg-subtle">{relevance}%</span>
      </div>

      {/* Quote */}
      <blockquote className="border-l-2 border-fz-accent-2/50 pl-2 text-fz-ui leading-relaxed text-fz-fg">
        “{passage.snippet}”
      </blockquote>

      {/* Source */}
      <div className="flex items-center justify-between gap-2 text-fz-micro text-fz-fg-muted">
        <span className="truncate" title={passage.documentTitle}>
          {passage.documentTitle} · p. {passage.pageNumber}
        </span>
        <button
          type="button"
          onClick={() => onShowInPage(passage)}
          className="shrink-0 text-fz-accent transition hover:text-fz-fg"
        >
          Go to source →
        </button>
      </div>

      {/* Citation */}
      <div className="rounded-md border border-fz-border bg-fz-bg/60 p-2">
        <p className="text-fz-micro leading-relaxed text-fz-fg-muted">{citation}</p>
        <div className="mt-1.5 flex justify-end gap-1">
          <Button
            size="sm"
            variant={saved ? 'primary' : 'ghost'}
            onClick={() => onSave(passage)}
            title="Collect this quote on your evidence shelf"
          >
            {saved ? 'Saved ✓' : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void copyCitation()}>
            Copy citation
          </Button>
        </div>
      </div>
    </Card>
  )
}
