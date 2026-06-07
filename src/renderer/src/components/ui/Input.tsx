import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border bg-fz-bg px-2.5 text-fz-ui text-fz-fg',
        'placeholder:text-fz-fg-subtle',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-fz-accent',
        invalid ? 'border-fz-danger/70' : 'border-fz-border focus:border-fz-accent',
        className
      )}
      {...rest}
    />
  )
})
