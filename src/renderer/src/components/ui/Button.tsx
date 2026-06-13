import { forwardRef } from 'react'
import { cn } from '../../lib/cn'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border border-transparent bg-fz-accent text-fz-bg font-semibold hover:opacity-90 active:opacity-80',
  secondary: 'border border-fz-border bg-fz-elevated/40 text-fz-fg hover:bg-fz-bg hover:border-fz-fg-subtle/40',
  ghost: 'border border-transparent text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg',
  danger: 'border border-fz-danger/50 bg-fz-danger/10 text-fz-danger hover:bg-fz-danger/20'
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1.5 px-2.5 text-fz-ui',
  md: 'h-9 gap-2 px-3.5 text-fz-body'
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

// The single button primitive. Replaces the copy-pasted
// `border border-fz-border px-2 py-0.5 text-[11px]` clusters with sane hit
// targets (28/36px tall) and readable 13/14px labels.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-md font-medium transition',
        'active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fz-accent',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        SIZES[size],
        VARIANTS[variant],
        className
      )}
      {...rest}
    >
      {loading && <Spinner size={size === 'sm' ? 12 : 14} />}
      {children}
    </button>
  )
})
