import { useState } from 'react'
import { useDocuments } from '../../hooks/useDocuments'
import { useDocumentStore } from '../../state/documentStore'
import { useOnboardingStore } from '../../state/onboardingStore'

export function EmptyReader(): React.JSX.Element {
  const { importDocument, error } = useDocuments()
  const importSample = useDocumentStore((s) => s.importSampleDocument)
  const showOnboarding = useOnboardingStore((s) => s.show)
  const [importing, setImporting] = useState(false)
  const [sampleBusy, setSampleBusy] = useState(false)

  const handleImport = async (): Promise<void> => {
    if (importing) return
    setImporting(true)
    try {
      await importDocument()
      showOnboarding()
    } finally {
      setImporting(false)
    }
  }

  const handleSample = async (): Promise<void> => {
    if (sampleBusy) return
    setSampleBusy(true)
    try {
      await importSample()
      showOnboarding()
    } finally {
      setSampleBusy(false)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-12">
      <div className="max-w-md text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-fz-accent-2/15 text-2xl font-bold text-fz-accent">
          F
        </div>
        <h1 className="mb-2 text-xl font-semibold text-fz-fg">Fuzzy</h1>
        <p className="mb-6 text-sm leading-relaxed text-fz-fg-muted">
          A reading workspace for hard documents.
          <br />
          Import a PDF, EPUB, or text file to start reading with AI.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || sampleBusy}
            className="rounded-md border border-fz-border bg-fz-surface-2 px-4 py-2 text-sm text-fz-fg hover:bg-fz-bg disabled:cursor-wait disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-fz-accent"
          >
            {importing ? 'Opening picker…' : 'Import document'}
          </button>
          <button
            type="button"
            onClick={handleSample}
            disabled={importing || sampleBusy}
            className="rounded-md border border-fz-accent-2/40 bg-fz-accent-2/10 px-4 py-2 text-sm text-fz-fg hover:bg-fz-accent-2/20 disabled:cursor-wait disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-fz-accent"
          >
            {sampleBusy ? 'Loading sample…' : 'Try sample document'}
          </button>
        </div>
        {error && <div className="mt-4 text-[11px] text-fz-danger">{error}</div>}
        <div className="mt-12 text-[10px] uppercase tracking-wider text-fz-fg-subtle">Privacy</div>
        <div className="mt-1 text-xs text-fz-fg-muted">
          Your files stay on this Mac. AI runs only when you request help.
        </div>
      </div>
    </div>
  )
}
