import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { IconButton } from './IconButton'

export type ModalSize = 'sm' | 'md' | 'lg'

const SIZES: Record<ModalSize, string> = {
  sm: 'w-[400px]',
  md: 'w-[520px]',
  lg: 'w-[680px]'
}

// The single dialog wrapper. Backdrop + centered elevated panel, Escape +
// backdrop-click close, focus trap, and body scroll lock. Replaces the three
// hand-rolled modal backdrops.
export function Modal({
  title,
  description,
  size = 'md',
  onClose,
  footer,
  children,
  className
}: {
  title: React.ReactNode
  description?: string
  size?: ModalSize
  onClose: () => void
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div
      className="fz-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'fz-palette-enter max-h-[88vh] max-w-[92vw] overflow-hidden rounded-fz border border-fz-border bg-fz-surface shadow-fz-pop outline-none',
          SIZES[size],
          className
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-fz-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-fz-title font-semibold text-fz-fg">{title}</h2>
            {description && <p className="mt-0.5 text-fz-micro text-fz-fg-subtle">{description}</p>}
          </div>
          <IconButton aria-label="Close" size="sm" onClick={onClose}>
            ✕
          </IconButton>
        </header>
        <div className="max-h-[68vh] overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-fz-border px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
