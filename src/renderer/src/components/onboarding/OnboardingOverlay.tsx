import { useOnboardingStore } from '../../state/onboardingStore'

const STEPS = [
  'Import a PDF or try the sample document.',
  'Highlight a difficult passage in the reader.',
  'Click Explain in the floating menu (or use ⌘K).',
  'Save the AI response as a margin note.',
  'Optional: plan a reading session from the bottom bar.'
] as const

export function OnboardingOverlay(): React.JSX.Element | null {
  const visible = useOnboardingStore((s) => s.visible)
  const step = useOnboardingStore((s) => s.step)
  const advance = useOnboardingStore((s) => s.advance)
  const dismiss = useOnboardingStore((s) => s.dismiss)

  if (!visible) return null

  const text = STEPS[Math.min(step, STEPS.length - 1)]

  return (
    <div
      className="fixed bottom-20 left-1/2 z-[60] w-[min(420px,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-fz-border bg-fz-surface-2 p-4 shadow-xl"
      role="status"
      aria-live="polite"
    >
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-fz-accent">
        Getting started · {step + 1}/{STEPS.length}
      </div>
      <p className="text-sm text-fz-fg">{text}</p>
      <p className="mt-2 text-[11px] text-fz-fg-muted">
        Your PDFs stay on this Mac. AI runs only when you request help.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => dismiss()}
          className="rounded border border-fz-border px-2 py-1 text-[11px] text-fz-fg-muted hover:bg-fz-bg"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={() => advance()}
          className="rounded border border-fz-accent-2/40 bg-fz-accent-2/20 px-2 py-1 text-[11px] text-fz-fg hover:bg-fz-accent-2/30"
        >
          {step >= STEPS.length - 1 ? 'Done' : 'Next'}
        </button>
      </div>
    </div>
  )
}
