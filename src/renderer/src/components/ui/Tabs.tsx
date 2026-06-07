import { cn } from '../../lib/cn'

export interface TabItem<T extends string> {
  id: T
  label: string
}

// Controlled tablist with an underline indicator and roving arrow-key focus.
// Consumers render the active panel themselves based on `value`.
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className
}: {
  tabs: ReadonlyArray<TabItem<T>>
  value: T
  onChange: (id: T) => void
  className?: string
}): React.JSX.Element {
  const onKeyDown = (e: React.KeyboardEvent): void => {
    const idx = tabs.findIndex((t) => t.id === value)
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      onChange(tabs[(idx + 1) % tabs.length].id)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onChange(tabs[(idx - 1 + tabs.length) % tabs.length].id)
    }
  }

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn('flex items-center gap-1', className)}
    >
      {tabs.map((tab) => {
        const active = tab.id === value
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative rounded-t px-2.5 py-1.5 text-fz-ui font-medium transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fz-accent',
              active ? 'text-fz-fg' : 'text-fz-fg-muted hover:text-fz-fg'
            )}
          >
            {tab.label}
            {active && (
              <span className="absolute inset-x-1.5 -bottom-px h-0.5 rounded-full bg-fz-accent-2" />
            )}
          </button>
        )
      })}
    </div>
  )
}
