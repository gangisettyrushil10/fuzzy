import { cn } from '../../lib/cn'

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  // surface = default reader/card bg; raised = elevated (popovers, menus).
  tone?: 'surface' | 'raised'
}

// Generic bordered surface container.
export function Panel({ tone = 'surface', className, children, ...rest }: PanelProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'rounded-fz border border-fz-border',
        tone === 'raised' ? 'bg-fz-elevated shadow-fz-pop' : 'bg-fz-surface',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
