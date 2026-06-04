import { useEffect, useState } from 'react'
import { useSettingsStore } from '../../state/settingsStore'
import type { ProviderMode } from '@shared/types/database'

export function SettingsPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { settings, load, setProviderMode, setOpenaiKey, setOpenaiModel, clearOpenaiKey } =
    useSettingsStore()
  const [keyInput, setKeyInput] = useState('')
  // The model input shows whatever the user has typed, falling back to the
  // saved settings value. Storing only the override avoids a sync effect.
  const [modelOverride, setModelOverride] = useState<string | null>(null)
  const modelInput = modelOverride ?? settings?.openaiModel ?? ''
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [load])

  if (!settings) {
    return (
      <Modal onClose={onClose}>
        <div className="text-xs text-fz-fg-muted">Loading settings…</div>
      </Modal>
    )
  }

  const onModeChange = async (mode: ProviderMode): Promise<void> => {
    setBusy(true)
    setErrorText(null)
    setFeedback(null)
    try {
      await setProviderMode(mode)
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const onSaveKey = async (): Promise<void> => {
    const trimmed = keyInput.trim()
    if (!trimmed) return
    setBusy(true)
    setErrorText(null)
    setFeedback(null)
    try {
      await setOpenaiKey(trimmed)
      setKeyInput('')
      setFeedback('API key saved (encrypted via macOS safeStorage).')
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : 'Failed to save key')
    } finally {
      setBusy(false)
    }
  }

  const onSaveModel = async (): Promise<void> => {
    if (!modelInput.trim()) return
    setBusy(true)
    setErrorText(null)
    setFeedback(null)
    try {
      await setOpenaiModel(modelInput.trim())
      setModelOverride(null)
      setFeedback('Model updated.')
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : 'Failed to save model')
    } finally {
      setBusy(false)
    }
  }

  const onClear = async (): Promise<void> => {
    setBusy(true)
    setErrorText(null)
    setFeedback(null)
    try {
      await clearOpenaiKey()
      setFeedback('API key removed.')
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-4 text-sm font-semibold text-fz-fg">Settings</h2>

      <Section title="AI provider">
        <div className="flex gap-2">
          <ProviderToggle
            label="Mock (no key)"
            description="Deterministic offline responses"
            selected={settings.providerMode === 'mock'}
            disabled={busy}
            onClick={() => onModeChange('mock')}
          />
          <ProviderToggle
            label="OpenAI"
            description={settings.hasOpenaiKey ? 'Using your saved key' : 'Add an API key below'}
            selected={settings.providerMode === 'openai'}
            disabled={busy}
            onClick={() => onModeChange('openai')}
          />
        </div>
      </Section>

      <Section title="OpenAI API key">
        <p className="mb-2 text-[11px] leading-relaxed text-fz-fg-muted">
          Your key is encrypted on disk using the Electron safeStorage API (Keychain on macOS) and
          never leaves the main process.
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            placeholder="sk-…"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            className="flex-1 rounded border border-fz-border bg-fz-bg px-2 py-1 text-xs text-fz-fg placeholder:text-fz-fg-subtle focus:border-fz-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={onSaveKey}
            disabled={busy || keyInput.trim().length === 0}
            className="rounded border border-fz-border px-3 py-1 text-[11px] hover:bg-fz-bg disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save key
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={busy || !settings.hasOpenaiKey}
            className="rounded border border-fz-border px-3 py-1 text-[11px] hover:bg-fz-bg disabled:cursor-not-allowed disabled:opacity-40"
          >
            Remove
          </button>
        </div>
        <div className="mt-1 text-[10px] text-fz-fg-subtle">
          Status: {settings.hasOpenaiKey ? 'Key on file' : 'No key saved'}
        </div>
      </Section>

      <Section title="OpenAI model">
        <div className="flex gap-2">
          <input
            value={modelInput}
            onChange={(e) => setModelOverride(e.target.value)}
            placeholder="gpt-4o-mini"
            className="flex-1 rounded border border-fz-border bg-fz-bg px-2 py-1 text-xs text-fz-fg placeholder:text-fz-fg-subtle focus:border-fz-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={onSaveModel}
            disabled={busy}
            className="rounded border border-fz-border px-3 py-1 text-[11px] hover:bg-fz-bg disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save model
          </button>
        </div>
      </Section>

      {feedback && <div className="mt-2 text-[11px] text-fz-accent">{feedback}</div>}
      {errorText && <div className="mt-2 text-[11px] text-red-300/80">{errorText}</div>}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-fz-border px-3 py-1 text-[11px] hover:bg-fz-bg"
        >
          Done
        </button>
      </div>
    </Modal>
  )
}

function Modal({
  onClose,
  children
}: {
  onClose: () => void
  children: React.ReactNode
}): React.JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fz-modal-backdrop fixed inset-0 z-40 flex items-center justify-center bg-black/60"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="w-[480px] max-w-[90vw] rounded-lg border border-fz-border bg-fz-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="mb-4">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-fz-fg-subtle">
        {title}
      </div>
      {children}
    </section>
  )
}

function ProviderToggle({
  label,
  description,
  selected,
  disabled,
  onClick
}: {
  label: string
  description: string
  selected: boolean
  disabled: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex-1 rounded-md border px-3 py-2 text-left text-xs',
        selected
          ? 'border-fz-accent-2/60 bg-fz-accent-2/10 text-fz-fg'
          : 'border-fz-border bg-fz-bg text-fz-fg-muted hover:text-fz-fg'
      ].join(' ')}
    >
      <div className="font-semibold">{label}</div>
      <div className="text-[11px] text-fz-fg-muted">{description}</div>
    </button>
  )
}
