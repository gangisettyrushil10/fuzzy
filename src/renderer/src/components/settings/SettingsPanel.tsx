import { useEffect, useState } from 'react'
import { useSettingsStore } from '../../state/settingsStore'
import { useReaderPrefsStore } from '../../state/readerPrefsStore'
import { useStudyPackPrefsStore } from '../../state/studyPackPrefsStore'
import {
  CITATION_FORMAT_LABELS,
  READER_PREF_LIMITS,
  type CitationFormat,
  type ComplexitySensitivity,
  type ProviderMode,
  type StudyExportFormat
} from '@shared/types/database'
import { Button, Input, Modal, SegmentedControl, Section, Slider, Tabs, type TabItem } from '../ui'
import { toast } from '../../state/toastStore'
import { AppearanceSettings } from './AppearanceSettings'
import { ReaderTypographyControls } from '../reader/ReaderTypographyControls'

type SettingsTab = 'appearance' | 'reading' | 'study' | 'ai'

const SETTINGS_TABS: ReadonlyArray<TabItem<SettingsTab>> = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'reading', label: 'Reading' },
  { id: 'study', label: 'Study' },
  { id: 'ai', label: 'AI' }
]

export function SettingsPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const {
    settings,
    load,
    setProviderMode,
    setOpenaiKey,
    setOpenaiModel,
    setOpenaiBaseUrl,
    clearOpenaiKey
  } = useSettingsStore()
  const prefs = useReaderPrefsStore((s) => s.prefs)
  const setPrefs = useReaderPrefsStore((s) => s.set)
  const studyPrefs = useStudyPackPrefsStore((s) => s.prefs)
  const studyPrefsLoaded = useStudyPackPrefsStore((s) => s.loaded)
  const loadStudyPrefs = useStudyPackPrefsStore((s) => s.load)
  const setStudyPrefs = useStudyPackPrefsStore((s) => s.set)

  const [tab, setTab] = useState<SettingsTab>('appearance')
  const [keyInput, setKeyInput] = useState('')
  const [modelOverride, setModelOverride] = useState<string | null>(null)
  const modelInput = modelOverride ?? settings?.openaiModel ?? ''
  const [baseUrlOverride, setBaseUrlOverride] = useState<string | null>(null)
  const baseUrlInput = baseUrlOverride ?? settings?.openaiBaseUrl ?? ''
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!studyPrefsLoaded) void loadStudyPrefs()
  }, [studyPrefsLoaded, loadStudyPrefs])

  if (!settings) {
    return (
      <Modal title="Settings" onClose={onClose}>
        <div className="text-fz-ui text-fz-fg-muted">Loading settings…</div>
      </Modal>
    )
  }

  const onModeChange = async (mode: ProviderMode): Promise<void> => {
    setBusy(true)
    try {
      await setProviderMode(mode)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to switch provider')
    } finally {
      setBusy(false)
    }
  }

  const onSaveKey = async (): Promise<void> => {
    const trimmed = keyInput.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      await setOpenaiKey(trimmed)
      setKeyInput('')
      toast.success('API key saved (encrypted via macOS Keychain).')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save key')
    } finally {
      setBusy(false)
    }
  }

  const onSaveModel = async (): Promise<void> => {
    if (!modelInput.trim()) return
    setBusy(true)
    try {
      await setOpenaiModel(modelInput.trim())
      setModelOverride(null)
      toast.success('Model updated.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save model')
    } finally {
      setBusy(false)
    }
  }

  const onSaveBaseUrl = async (): Promise<void> => {
    setBusy(true)
    try {
      await setOpenaiBaseUrl(baseUrlInput.trim() || null)
      setBaseUrlOverride(null)
      toast.success(baseUrlInput.trim() ? 'Base URL saved.' : 'Base URL cleared.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save base URL')
    } finally {
      setBusy(false)
    }
  }

  const onClear = async (): Promise<void> => {
    setBusy(true)
    try {
      await clearOpenaiKey()
      toast.success('API key removed.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove key')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Settings"
      size="lg"
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <Tabs
        tabs={SETTINGS_TABS}
        value={tab}
        onChange={setTab}
        className="-mt-1 mb-4 border-b border-fz-border"
      />

      {tab === 'appearance' && <AppearanceSettings />}

      {tab === 'reading' && (
        <div className="space-y-6">
          {/* Reading appearance — font, size, spacing, alignment, page theme.
              Shared with the in-reader "Aa" popover. */}
          <Section
            title="Reading appearance"
            description="Font, size, spacing, and page colors — also available from the “Aa” button in the reader."
          >
            <ReaderTypographyControls />
          </Section>

        {/* Reading aids */}
        <Section title="Reading aids" description="Pacer, complex-word highlighting, and motion.">
          <div className="space-y-3">
            <Row label="Complex words">
              <SegmentedControl<ComplexitySensitivity>
                size="sm"
                aria-label="Complex-word sensitivity"
                value={prefs.complexitySensitivity}
                onChange={(v) => void setPrefs({ complexitySensitivity: v })}
                options={[
                  { value: 'off', label: 'Off' },
                  { value: 'subtle', label: 'Subtle' },
                  { value: 'aggressive', label: 'More' }
                ]}
              />
            </Row>
            <LabeledSlider
              label={`Pacer speed — ${prefs.targetWpm} wpm`}
              value={prefs.targetWpm}
              min={READER_PREF_LIMITS.targetWpm.min}
              max={READER_PREF_LIMITS.targetWpm.max}
              step={10}
              onChange={(v) => void setPrefs({ targetWpm: v })}
            />
            <Row label="Animations">
              <SegmentedControl<'on' | 'off'>
                size="sm"
                aria-label="Animations"
                value={prefs.animations ? 'on' : 'off'}
                onChange={(v) => void setPrefs({ animations: v === 'on' })}
                options={[
                  { value: 'on', label: 'On' },
                  { value: 'off', label: 'Off' }
                ]}
              />
            </Row>
            <Row label="Citation style">
              <SegmentedControl<CitationFormat>
                size="sm"
                aria-label="Default citation style"
                value={prefs.citationFormat}
                onChange={(v) => void setPrefs({ citationFormat: v })}
                options={(Object.keys(CITATION_FORMAT_LABELS) as CitationFormat[]).map((value) => ({
                  value,
                  label: CITATION_FORMAT_LABELS[value]
                }))}
              />
            </Row>
          </div>
        </Section>

        </div>
      )}

      {tab === 'study' && (
        <div className="space-y-6">
          <Section
            title="Default export format"
            description="The format suggested first when you export a study pack."
          >
            <SegmentedControl<StudyExportFormat>
              size="sm"
              aria-label="Default export format"
              value={studyPrefs.defaultExportFormat}
              onChange={(v) => void setStudyPrefs({ defaultExportFormat: v })}
              options={[
                { value: 'quizlet', label: 'Quizlet' },
                { value: 'anki', label: 'Anki' },
                { value: 'csv', label: 'CSV' },
                { value: 'markdown', label: 'Markdown' }
              ]}
            />
          </Section>

          <Section
            title="Spaced repetition"
            description="Surface flashcards due for review on the home screen."
          >
            <Row label="Review reminders">
              <SegmentedControl<'on' | 'off'>
                size="sm"
                aria-label="Spaced repetition"
                value={studyPrefs.spacedRepetitionEnabled ? 'on' : 'off'}
                onChange={(v) => void setStudyPrefs({ spacedRepetitionEnabled: v === 'on' })}
                options={[
                  { value: 'on', label: 'On' },
                  { value: 'off', label: 'Off' }
                ]}
              />
            </Row>
          </Section>

          <p className="text-fz-micro leading-relaxed text-fz-fg-subtle">
            Difficulty, question formats, content focus, and counts are chosen each time you build a
            pack — your last choices are remembered. Quizlet has no public import API, so “Copy for
            Quizlet” puts an import-ready list on your clipboard and opens Quizlet’s create page.
          </p>
        </div>
      )}

      {tab === 'ai' && (
        <div className="space-y-6">
          {/* AI provider */}
          <Section title="AI provider" description="Mock is fully offline and deterministic.">
          <SegmentedControl<ProviderMode>
            aria-label="AI provider"
            value={settings.providerMode}
            onChange={(v) => void onModeChange(v)}
            options={[
              { value: 'mock', label: 'Mock (no key)' },
              { value: 'openai', label: 'OpenAI' }
            ]}
          />
        </Section>

        <Section
          title="API key"
          description="Encrypted on disk via the macOS Keychain; never leaves the main process. Defaults to a free Groq key (gsk_…); use sk-… for OpenAI."
        >
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="gsk_… (Groq) or sk-… (OpenAI)"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            <Button
              variant="primary"
              onClick={() => void onSaveKey()}
              disabled={busy || keyInput.trim().length === 0}
            >
              Save
            </Button>
            <Button variant="ghost" onClick={() => void onClear()} disabled={busy || !settings.hasOpenaiKey}>
              Remove
            </Button>
          </div>
          <p className="mt-1.5 text-fz-micro text-fz-fg-subtle">
            {settings.hasOpenaiKey ? 'Key on file.' : 'No key saved.'}
          </p>
        </Section>

        <Section title="Model" description="Defaults to the free Llama 3.3 70B on Groq.">
          <div className="flex gap-2">
            <Input
              value={modelInput}
              onChange={(e) => setModelOverride(e.target.value)}
              placeholder="llama-3.3-70b-versatile"
            />
            <Button variant="primary" onClick={() => void onSaveModel()} disabled={busy}>
              Save
            </Button>
          </div>
        </Section>

        <Section
          title="API base URL (optional)"
          description="Point BYOK at any OpenAI-compatible endpoint to test with free/local models."
        >
          <div className="flex gap-2">
            <Input
              value={baseUrlInput}
              onChange={(e) => setBaseUrlOverride(e.target.value)}
              placeholder="https://api.groq.com/openai/v1"
            />
            <Button variant="primary" onClick={() => void onSaveBaseUrl()} disabled={busy}>
              Save
            </Button>
          </div>
          <p className="mt-1.5 text-fz-micro leading-relaxed text-fz-fg-subtle">
            Free options: Groq <code>https://api.groq.com/openai/v1</code> · OpenRouter{' '}
            <code>https://openrouter.ai/api/v1</code> · Ollama (local){' '}
            <code>http://localhost:11434/v1</code>. Leave blank for the free Groq default; set{' '}
            <code>https://api.openai.com/v1</code> for OpenAI.
          </p>
        </Section>
        </div>
      )}
    </Modal>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-fz-ui text-fz-fg-muted">{label}</span>
      {children}
    </div>
  )
}

function LabeledSlider({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <span className="text-fz-ui text-fz-fg-muted">{label}</span>
      <Slider aria-label={label} value={value} min={min} max={max} step={step} onChange={onChange} />
    </div>
  )
}
