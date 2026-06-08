import { useAmbientStore } from '../../state/ambientStore'
import { useTypewriter } from '../../hooks/useTypewriter'
import { Spinner } from '../ui'

// Quiet, dismissible card (bottom-left, clear of the pacer bar + focus HUD) that
// surfaces the hardest sentence on the page with a streamed explanation.
export function AmbientGlossCard(): React.JSX.Element | null {
  const target = useAmbientStore((s) => s.target)
  const status = useAmbientStore((s) => s.status)
  const explanation = useAmbientStore((s) => s.explanation)
  const dismiss = useAmbientStore((s) => s.dismiss)
  const setEnabled = useAmbientStore((s) => s.setEnabled)

  const { display } = useTypewriter({
    id: target ? `ambient:${target.documentId}:${target.pageNumber}` : 'ambient:none',
    text: explanation ?? '',
    enabled: status === 'done'
  })

  if (!target) return null

  return (
    <div className="pointer-events-auto fixed bottom-12 left-4 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-fz border border-fz-border bg-fz-elevated/95 p-3 shadow-fz-pop backdrop-blur">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-fz-micro font-semibold uppercase tracking-wider text-fz-accent">
          Hardest line on this page
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-fz-micro text-fz-fg-subtle transition hover:text-fz-fg"
            title="Turn off ambient explanations"
            onClick={() => setEnabled(false)}
          >
            turn off
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            className="text-fz-fg-subtle transition hover:text-fz-fg"
            onClick={dismiss}
          >
            ✕
          </button>
        </div>
      </div>
      <blockquote className="mb-2 line-clamp-3 border-l-2 border-fz-accent-2/50 pl-2 text-fz-micro italic text-fz-fg-muted">
        {target.sentence}
      </blockquote>
      {status === 'loading' && !explanation ? (
        <span className="flex items-center gap-2 text-fz-ui text-fz-fg-muted">
          <Spinner size={12} /> Unpacking it…
        </span>
      ) : status === 'error' ? (
        <span className="text-fz-ui text-fz-danger">Couldn’t explain that one.</span>
      ) : (
        <p className="whitespace-pre-wrap text-fz-ui leading-relaxed text-fz-fg">{display}</p>
      )}
    </div>
  )
}
