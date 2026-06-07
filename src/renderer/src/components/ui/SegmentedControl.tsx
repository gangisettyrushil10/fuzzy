import { cn } from '../../lib/cn'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

// Pill segmented toggle. Used for citation format, complexity sensitivity,
// provider mode, and study-pack tabs.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  'aria-label': ariaLabel,
  className
}: {
  options: ReadonlyArray<SegmentOption<T>>
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  'aria-label'?: string
  className?: string
}): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-fz-border bg-fz-bg p-0.5',
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded font-medium transition',
              size === 'sm' ? 'px-2 py-0.5 text-fz-micro' : 'px-2.5 py-1 text-fz-ui',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fz-accent',
              active
                ? 'bg-fz-accent-2/25 text-fz-fg'
                : 'text-fz-fg-muted hover:bg-fz-elevated hover:text-fz-fg'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
