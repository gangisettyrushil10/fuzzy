import { cn } from '../../lib/cn'

export function Spinner({
  size = 16,
  className
}: {
  size?: number
  className?: string
}): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        'fz-spinner inline-block rounded-full border-2 border-fz-accent border-t-transparent',
        className
      )}
      style={{ width: size, height: size }}
    />
  )
}
