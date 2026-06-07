import { useDocumentStore } from '../../state/documentStore'
import { useSettingsStore } from '../../state/settingsStore'
import { useTutorStore } from '../../state/tutorStore'
import { useAppUiStore } from '../../state/appUiStore'
import { Button } from '../ui'

export function TopBar({ onOpenSettings }: { onOpenSettings: () => void }): React.JSX.Element {
  const documents = useDocumentStore((s) => s.documents)
  const importing = useDocumentStore((s) => s.importing)
  const importDocument = useDocumentStore((s) => s.importDocument)
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const settings = useSettingsStore((s) => s.settings)
  const tutorStatus = useTutorStore((s) => s.status)
  const setEssayOpen = useAppUiStore((s) => s.setEssayOpen)

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
        <span className="flex items-center gap-1.5 rounded-md border border-fz-border px-2 py-1 text-fz-micro uppercase tracking-wider">
          <span className={`h-1.5 w-1.5 rounded-full ${aiStatusDot}`} />
          {aiBadgeLabel}
        </span>
        <Button
          size="sm"
          variant="primary"
          onClick={() => importDocument()}
          loading={importing}
          title="Import document (⌘O)"
        >
          {importing ? 'Importing…' : 'Import'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setEssayOpen(true)}
          title="Open the Essay Workspace"
        >
          Write
        </Button>
        <Button size="sm" variant="secondary" onClick={onOpenSettings} title="Settings (⌘,)">
          Settings
        </Button>
      </div>
    </header>
  )
}
