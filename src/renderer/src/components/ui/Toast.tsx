import { cn } from '../../lib/cn'
import type { ToastVariant } from '../../state/toastStore'

const VARIANTS: Record<ToastVariant, string> = {
  success: 'border-fz-success/40 bg-fz-success/10 text-fz-success',
  error: 'border-fz-danger/40 bg-fz-danger/10 text-fz-danger',
  info: 'border-fz-border bg-fz-elevated text-fz-fg'
}

// Presentational toast row (ToastViewport positions a stack of these).
export function Toast({
  message,
  variant,
  onDismiss
}: {
  message: string
  variant: ToastVariant
  onDismiss: () => void
}): React.JSX.Element {
  return (
    <div
      role="status"
      className={cn(
        'fz-toast pointer-events-auto flex items-center gap-2 rounded-md border px-3 py-2 text-fz-ui shadow-fz-pop',
        VARIANTS[variant]
      )}
    >
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="shrink-0 text-fz-fg-subtle transition hover:text-fz-fg"
      >
        ✕
      </button>
    </div>
  )
}
