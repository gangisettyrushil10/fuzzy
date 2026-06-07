import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

export type IconButtonVariant = 'secondary' | 'ghost'
export type IconButtonSize = 'sm' | 'md'

const VARIANTS: Record<IconButtonVariant, string> = {
  secondary: 'border border-fz-border bg-fz-elevated/40 text-fz-fg hover:bg-fz-bg',
  ghost: 'border border-transparent text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg'
}

const SIZES: Record<IconButtonSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9'
}

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  // Icon-only buttons must carry an accessible label.
  'aria-label': string
  variant?: IconButtonVariant
  size?: IconButtonSize
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', size = 'md', className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md transition',
        'active:scale-[0.96]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fz-accent',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        SIZES[size],
        VARIANTS[variant],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
})
