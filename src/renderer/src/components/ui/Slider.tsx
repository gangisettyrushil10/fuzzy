import { cn } from '../../lib/cn'

export interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  'aria-label': string
  className?: string
  disabled?: boolean
}

// Range input styled to the dark theme. Used by the pacer WPM control and
// reader font-size/line-height settings.
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  className,
  disabled,
  ...rest
}: SliderProps): React.JSX.Element {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-fz-border accent-fz-accent-2',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fz-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...rest}
    />
  )
}
