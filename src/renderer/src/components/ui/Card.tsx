import { cn } from '../../lib/cn'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  selected?: boolean
}

// A Panel variant for list rows (library items, ranked quotes). When
// interactive, it gets hover lift + a selected accent state.
export function Card({
  interactive = false,
  selected = false,
  className,
  children,
  ...rest
}: CardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'rounded-fz border bg-fz-surface transition',
        interactive && 'cursor-pointer hover:border-fz-fg-subtle/40 hover:bg-fz-elevated',
        selected ? 'border-fz-accent-2/70 bg-fz-accent-2/10' : 'border-fz-border',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
