import { useState } from 'react'
import { cn } from '../../lib/cn'

export type TooltipPlacement = 'top' | 'bottom'

// Lightweight hover/focus tooltip. CSS-positioned relative to the trigger —
// good enough for icon-button labels without a popover library. Shows on
// hover and keyboard focus.
export function Tooltip({
  label,
  placement = 'bottom',
  children,
  className
}: {
  label: string
  placement?: TooltipPlacement
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md',
            'border border-fz-border bg-fz-elevated px-2 py-1 text-fz-micro text-fz-fg shadow-fz-pop',
            placement === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
          )}
        >
          {label}
        </span>
      )}
    </span>
  )
}
