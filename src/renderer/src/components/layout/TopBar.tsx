import { useDocumentStore } from '../../state/documentStore'
import { useSettingsStore } from '../../state/settingsStore'
import { useTutorStore } from '../../state/tutorStore'

export function TopBar({ onOpenSettings }: { onOpenSettings: () => void }): React.JSX.Element {
  const documents = useDocumentStore((s) => s.documents)
  const importing = useDocumentStore((s) => s.importing)
  const importDocument = useDocumentStore((s) => s.importDocument)
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const settings = useSettingsStore((s) => s.settings)
  const tutorStatus = useTutorStore((s) => s.status)

  const active = documents.find((d) => d.id === activeDocumentId) ?? null

  const aiBadgeLabel = !settings
    ? 'AI: …'
    : settings.providerMode === 'openai' && settings.hasOpenaiKey
      ? `AI: openai`
      : settings.providerMode === 'openai'
        ? 'AI: openai (no key)'
        : 'AI: mock'

  const aiStatusDot =
    tutorStatus === 'loading'
      ? 'bg-fz-accent animate-pulse'
      : tutorStatus === 'error'
        ? 'bg-red-400'
        : tutorStatus === 'success'
          ? 'bg-fz-accent'
          : 'bg-fz-fg-subtle'

  return (
    <header className="fz-drag flex h-11 shrink-0 items-center gap-3 border-b border-fz-border bg-fz-surface-2 pl-20 pr-3 text-xs">
      <div className="fz-no-drag flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-fz-accent-2/20 text-fz-accent">
          <span className="text-[11px] font-semibold">F</span>
        </div>
        <span className="font-semibold tracking-wide">Fuzzy</span>
        <span className="text-fz-fg-subtle">·</span>
        <span className="max-w-[280px] truncate text-fz-fg-muted" title={active?.title}>
          {active?.title ?? 'No document open'}
        </span>
      </div>
      <div className="flex-1" />
      <div className="fz-no-drag flex items-center gap-2 text-fz-fg-muted">
        <span className="flex items-center gap-1.5 rounded border border-fz-border px-2 py-0.5 text-[10px] uppercase tracking-wider">
          <span className={`h-1.5 w-1.5 rounded-full ${aiStatusDot}`} />
          {aiBadgeLabel}
        </span>
        <button
          type="button"
          onClick={() => importDocument()}
          disabled={importing}
          className="rounded border border-fz-border px-2 py-0.5 text-[11px] hover:bg-fz-bg disabled:opacity-50"
          title="Import PDF (⌘O)"
        >
          {importing ? 'Importing…' : 'Import PDF'}
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded border border-fz-border px-2 py-0.5 text-[11px] hover:bg-fz-bg"
          title="Settings (⌘,)"
        >
          Settings
        </button>
      </div>
    </header>
  )
}
