import { forwardRef, useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  // Grow with content up to maxRows (default off — fixed rows).
  autoGrow?: boolean
  maxRows?: number
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, autoGrow = false, maxRows = 10, className, value, onChange, ...rest },
  ref
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null)

  const setRefs = (el: HTMLTextAreaElement | null): void => {
    innerRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
  }

  useEffect(() => {
    if (!autoGrow) return
    const el = innerRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight || '20')
    const max = lineHeight * maxRows
    el.style.height = `${Math.min(el.scrollHeight, max)}px`
  }, [autoGrow, maxRows, value])

  return (
    <textarea
      ref={setRefs}
      value={value}
      onChange={onChange}
      className={cn(
        'w-full resize-none rounded-md border bg-fz-bg px-2.5 py-2 text-fz-ui leading-relaxed text-fz-fg',
        'placeholder:text-fz-fg-subtle',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-fz-accent',
        invalid ? 'border-fz-danger/70' : 'border-fz-border focus:border-fz-accent',
        className
      )}
      {...rest}
    />
  )
})
