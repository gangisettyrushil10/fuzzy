import { cn } from '../../lib/cn'

// Renders a keyboard keycap for shortcut hints.
export function Kbd({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-[1.25rem] items-center justify-center rounded border border-fz-border bg-fz-bg px-1.5 py-0.5',
        'font-mono text-fz-micro leading-none text-fz-fg-muted',
        className
      )}
    >
      {children}
    </kbd>
  )
}
