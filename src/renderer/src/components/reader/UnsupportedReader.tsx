import { FILE_FORMATS, type FileType } from '@shared/formats'

// Placeholder shown for documents whose reader hasn't been wired yet. The
// document still imported and is stored; only the in-app viewer is pending.
// Per-format agents replace this path by adding a real reader case in
// DocumentReader and flipping `readerReady`.
export function UnsupportedReader({
  title,
  fileType
}: {
  title?: string
  fileType: FileType | null
}): React.JSX.Element {
  const label = fileType ? FILE_FORMATS[fileType].label : 'document'
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center border-b border-fz-border bg-fz-surface-2 px-3 text-xs text-fz-fg-muted">
        {title ?? 'Untitled'}
      </div>
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="max-w-sm text-center">
          <div className="mb-3 text-sm font-medium text-fz-fg">
            {label} reading isn’t available yet
          </div>
          <p className="text-xs leading-relaxed text-fz-fg-muted">
            This file was imported and saved to your library. The in-app reader for{' '}
            {label.toLowerCase()} files is being built — it’ll open here once it ships.
          </p>
        </div>
      </div>
    </div>
  )
}
