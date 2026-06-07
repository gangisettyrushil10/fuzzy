import { useToastStore } from '../../state/toastStore'
import { Toast } from './Toast'

// Mounted once in AppShell. Renders the global toast stack bottom-right,
// above all panels.
export function ToastViewport(): React.JSX.Element {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} variant={t.variant} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}
