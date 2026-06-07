import { useEffect, useState } from 'react'
import type { DocMetadata } from '@shared/types/database'
import { Button, Input } from '../ui'
import { toast } from '../../state/toastStore'

// Edit the citation metadata for a document. This is the PRIMARY path for
// good citations — auto-extraction fills maybe a third of files, so the user
// confirms/edits author, year, publisher here.
export function CitationDetailsForm({
  documentId,
  onSaved
}: {
  documentId: string
  onSaved?: () => void
}): React.JSX.Element {
  const [meta, setMeta] = useState<DocMetadata>({
    author: null,
    year: null,
    publisher: null,
    sourceUrl: null
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    window.fuzzy.thesis
      .getMetadata(documentId)
      .then((m) => {
        if (cancelled) return
        if (m) setMeta(m)
        setLoading(false)
      })
      .catch(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [documentId])

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      await window.fuzzy.thesis.updateMetadata(documentId, meta)
      toast.success('Citation details saved')
      onSaved?.()
    } catch {
      toast.error('Could not save citation details')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-fz-micro text-fz-fg-subtle">Loading details…</p>
  }

  return (
    <div className="space-y-2">
      <Field label="Author">
        <Input
          value={meta.author ?? ''}
          placeholder="e.g. Darwin, Charles"
          onChange={(e) => setMeta({ ...meta, author: e.target.value || null })}
        />
      </Field>
      <div className="flex gap-2">
        <Field label="Year" className="w-24">
          <Input
            value={meta.year ?? ''}
            inputMode="numeric"
            placeholder="2024"
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10)
              setMeta({ ...meta, year: Number.isFinite(n) ? n : null })
            }}
          />
        </Field>
        <Field label="Publisher" className="flex-1">
          <Input
            value={meta.publisher ?? ''}
            placeholder="e.g. Penguin"
            onChange={(e) => setMeta({ ...meta, publisher: e.target.value || null })}
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="primary" loading={saving} onClick={() => void save()}>
          Save details
        </Button>
      </div>
    </div>
  )
}

function Field({
  label,
  className,
  children
}: {
  label: string
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className={className}>
      <span className="mb-1 block text-fz-micro font-medium uppercase tracking-wider text-fz-fg-subtle">
        {label}
      </span>
      {children}
    </label>
  )
}
