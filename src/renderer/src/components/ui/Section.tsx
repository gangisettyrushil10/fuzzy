import { cn } from '../../lib/cn'

// A labeled form/content section: an uppercase header (fz-label, 12px) plus a
// body. Replaces the private Section in SettingsPanel and the repeated
// `text-[10px] uppercase tracking-wider` header spans.
export function Section({
  title,
  description,
  action,
  className,
  children
}: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-fz-label font-semibold uppercase tracking-wider text-fz-fg-subtle">
            {title}
          </h3>
          {description && <p className="mt-0.5 text-fz-micro text-fz-fg-subtle">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
