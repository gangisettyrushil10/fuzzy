import type { CitationFormat, EvidenceItem, EvidenceStrength } from '@shared/types/database'
import { Button, Card } from '../ui'
import { toast } from '../../state/toastStore'

const STRENGTH_STYLE: Record<EvidenceStrength, { label: string; cls: string }> = {
  strong: { label: 'Strong', cls: 'bg-fz-success/15 text-fz-success' },
  moderate: { label: 'Moderate', cls: 'bg-fz-accent-2/15 text-fz-accent-2' },
  weak: { label: 'Suggestive', cls: 'bg-fz-warning/15 text-fz-warning' }
}

// One verified piece of evidence: the quoted span, why it counts (the judge's
// rationale), strength, source + page, and actions. The whole card is clickable
// — it jumps to the source page and flashes the passage — while still letting
// the user select the quote text (a click during an active selection is
// ignored). Copy quote / copy citation are explicit buttons.
export function EvidenceResultCard({
  item,
  index,
  citationFormat,
  onShowInPage
}: {
  item: EvidenceItem
  index: number
  citationFormat: CitationFormat
  onShowInPage: (item: EvidenceItem) => void
}): React.JSX.Element {
  const citation = item.citations[citationFormat]
  const strength = STRENGTH_STYLE[item.strength]

  // A click that's really a text-selection drag shouldn't navigate.
  const activate = (): void => {
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed && sel.toString().trim()) return
    onShowInPage(item)
  }

  const copy = async (text: string, label: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`)
    }
  }

  return (
    <Card
      interactive
      role="button"
      tabIndex={0}
      title="Click to highlight this passage in the source"
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onShowInPage(item)
        }
      }}
      className="fz-palette-enter group space-y-2 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fz-accent"
      style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-fz-micro font-semibold uppercase tracking-wider ${strength.cls}`}
        >
          {strength.label}
        </span>
        <span className="text-fz-micro tabular-nums text-fz-fg-subtle">p. {item.pageNumber}</span>
      </div>

      <blockquote className="border-l-2 border-fz-accent-2/50 pl-2 text-fz-ui leading-relaxed text-fz-fg">
        “{item.snippet}”
      </blockquote>

      {item.rationale && (
        <p className="text-fz-micro leading-relaxed text-fz-fg-muted">{item.rationale}</p>
      )}

      <div className="flex items-center justify-between gap-2 text-fz-micro text-fz-fg-muted">
        <span className="truncate" title={item.documentTitle}>
          {item.documentTitle}
        </span>
        <span className="shrink-0 text-fz-accent opacity-0 transition group-hover:opacity-100">
          Go to source →
        </span>
      </div>

      <div className="flex justify-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            void copy(`“${item.snippet}”`, 'Quote')
          }}
        >
          Copy quote
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            void copy(citation, 'Citation')
          }}
        >
          Copy citation
        </Button>
      </div>
    </Card>
  )
}
