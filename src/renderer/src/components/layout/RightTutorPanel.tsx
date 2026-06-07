import { useCallback, useState } from 'react'
import { actionLabel, tutorProviderLabel, useTutorStore, type TutorMessage } from '../../state/tutorStore'
import { useSettingsStore } from '../../state/settingsStore'
import { useStudyPackStore } from '../../state/studyPackStore'
import { DEFAULT_STUDY_PACK_OPTIONS } from '@shared/types/database'
import { useTypewriter } from '../../hooks/useTypewriter'
import { Tabs } from '../ui'
import { ThesisPanel } from '../thesis/ThesisPanel'
import { EvidencePanel } from '../evidence/EvidencePanel'
import { TonePanel } from '../tone/TonePanel'
import { AskPanel } from '../ask/AskPanel'

type PanelTab = 'tutor' | 'thesis' | 'evidence' | 'tone' | 'ask'
const PANEL_TABS = [
  { id: 'tutor' as const, label: 'Tutor' },
  { id: 'thesis' as const, label: 'Thesis' },
  { id: 'evidence' as const, label: 'Evidence' },
  { id: 'tone' as const, label: 'Tone' },
  { id: 'ask' as const, label: 'Ask' }
]
export function RightTutorPanel({
  onOpenSettings
}: {
  onOpenSettings: () => void
}): React.JSX.Element {
  const {
    status,
    request,
    result,
    messages,
    error,
    errorCode,
    savedAnnotationId,
    followUpDraft,
    saveToast,
    saveAsNote,
    regenerate,
    askFollowUp,
    setFollowUpDraft,
    clear
  } = useTutorStore()
  const settings = useSettingsStore((s) => s.settings)
  const pack = useStudyPackStore((s) => s.pack)
  const generatePack = useStudyPackStore((s) => s.generate)
  const activeDocumentId = useStudyPackStore((s) => s.documentId)
  const [copyOk, setCopyOk] = useState(false)
  const [tab, setTab] = useState<PanelTab>('tutor')

  const headerStatus =
    status === 'loading'
      ? 'thinking'
      : status === 'success'
        ? 'ready'
        : status === 'error'
          ? 'error'
          : 'idle'

  const providerBanner = (() => {
    if (!settings) return null
    if (settings.providerMode === 'openai' && !settings.hasOpenaiKey) {
      return 'OpenAI selected but no key — responses use mock mode.'
    }
    if (result?.fallbackReason === 'no_api_key') {
      return 'Running in mock mode (no API key).'
    }
    return null
  })()

  const copyResponse = useCallback(async () => {
    if (!result?.outputText) return
    try {
      await navigator.clipboard.writeText(result.outputText)
      setCopyOk(true)
      window.setTimeout(() => setCopyOk(false), 1500)
    } catch {
      /* ignore */
    }
  }, [result])

  const addFlashcardFromResponse = useCallback(async () => {
    if (!result?.outputText || !activeDocumentId) return
    if (!pack) {
      await generatePack(activeDocumentId, DEFAULT_STUDY_PACK_OPTIONS).catch(() => undefined)
    }
    const question = request?.selectedText.slice(0, 200) ?? 'Key idea'
    const answer = result.outputText.slice(0, 500)
    alert(
      `Flashcard draft copied to clipboard.\n\nQ: ${question.slice(0, 80)}…\n\nRegenerate your study pack to include new cards automatically in a future update.`
    )
    await navigator.clipboard.writeText(`Q: ${question}\nA: ${answer}`)
  }, [result, request, pack, activeDocumentId, generatePack])

  return (
    <aside className="flex w-96 shrink-0 flex-col bg-fz-surface-2 text-sm">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-fz-border px-3">
        <Tabs tabs={PANEL_TABS} value={tab} onChange={setTab} className="min-w-0 overflow-x-auto" />
        {tab === 'tutor' && (
          <span className="shrink-0 pl-2 text-fz-micro text-fz-fg-subtle">{headerStatus}</span>
        )}
      </header>

      {tab === 'thesis' && <ThesisPanel />}

      {tab === 'evidence' && <EvidencePanel />}

      {tab === 'tone' && <TonePanel />}

      {tab === 'ask' && <AskPanel />}

      {tab === 'tutor' && providerBanner && (
        <div className="border-b border-fz-warning/30 bg-fz-warning/10 px-3 py-1.5 text-[10px] text-fz-warning">
          {providerBanner}
        </div>
      )}

      {tab === 'tutor' && status === 'idle' && (
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <p className="text-xs leading-relaxed text-fz-fg-muted">
            Select text in a document to ask Fuzzy to <span className="text-fz-fg">explain</span>,{' '}
            <span className="text-fz-fg">simplify</span>, or{' '}
            <span className="text-fz-fg">quiz you</span> on it.
          </p>
        </div>
      )}

      {tab === 'tutor' && status !== 'idle' && request && (
        <div className="fz-selectable flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
          <div className="rounded-md border border-fz-border bg-fz-bg/50 p-2 text-[11px] text-fz-fg-muted">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold uppercase tracking-wider text-fz-fg-subtle">
                {actionLabel(request.action)} · p.{request.pageNumber}
              </span>
              <button
                type="button"
                onClick={clear}
                className="text-[10px] text-fz-fg-subtle hover:text-fz-fg-muted focus-visible:ring-2 focus-visible:ring-fz-accent"
              >
                clear
              </button>
            </div>
            <p className="line-clamp-3 text-[11px] italic text-fz-fg-muted">
              {`"${request.selectedText}"`}
            </p>
          </div>

          {status === 'loading' && (
            <div className="space-y-2" aria-busy="true" aria-live="polite">
              <div className="flex items-center gap-2 text-xs text-fz-fg-muted">
                <span className="fz-spinner inline-block h-3 w-3 rounded-full border-2 border-fz-accent border-t-transparent" />
                Reading the passage…
              </div>
              <div className="space-y-2">
                <div className="fz-skeleton h-3 w-full rounded" />
                <div className="fz-skeleton h-3 w-5/6 rounded" />
                <div className="fz-skeleton h-3 w-4/6 rounded" />
              </div>
            </div>
          )}

          {status === 'error' && error && (
            <div className="rounded-md border border-fz-danger/40 bg-fz-danger/10 p-3 text-xs text-fz-danger">
              <p>{error}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => regenerate()}
                  className="rounded border border-fz-border px-2 py-0.5 text-[10px] hover:bg-fz-bg"
                >
                  Retry
                </button>
                {errorCode === 'auth' && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="rounded border border-fz-border px-2 py-0.5 text-[10px] hover:bg-fz-bg"
                  >
                    Open Settings
                  </button>
                )}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div className="space-y-2">
              {messages.map((m, i) => (
                <div
                  key={m.id}
                  className={[
                    'whitespace-pre-wrap rounded-md border p-3 text-xs leading-relaxed',
                    m.role === 'assistant'
                      ? 'border-fz-border bg-fz-bg/40 text-fz-fg'
                      : 'border-fz-accent-2/30 bg-fz-accent-2/10 text-fz-fg-muted'
                  ].join(' ')}
                >
                  {m.role === 'user' ? (
                    <span className="mb-1 block text-[10px] font-semibold uppercase text-fz-fg-subtle">
                      You
                    </span>
                  ) : null}
                  <TutorMessageBody
                    message={m}
                    reveal={i === messages.length - 1 && m.role === 'assistant'}
                  />
                </div>
              ))}
            </div>
          )}

          {status === 'success' && result && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-fz-fg-subtle">
                <span>{tutorProviderLabel(result)}</span>
                <div className="flex flex-wrap gap-1">
                  <ActionChip label={copyOk ? 'copied ✓' : 'copy'} onClick={() => copyResponse()} />
                  <ActionChip
                    label="regenerate"
                    onClick={() => regenerate().catch(console.error)}
                  />
                  <ActionChip
                    label={savedAnnotationId ? 'saved ✓' : 'save note'}
                    disabled={savedAnnotationId !== null}
                    onClick={() => saveAsNote().catch(console.error)}
                  />
                  <ActionChip label="flashcard" onClick={() => addFlashcardFromResponse()} />
                </div>
              </div>
              {saveToast && (
                <div className="fz-toast rounded border border-fz-success/40 bg-fz-success/10 px-2 py-1 text-[11px] text-fz-success">
                  Note saved to library
                </div>
              )}
              <form
                className="mt-1 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  askFollowUp(followUpDraft).catch(console.error)
                }}
              >
                <input
                  type="text"
                  value={followUpDraft}
                  onChange={(e) => setFollowUpDraft(e.target.value)}
                  placeholder="Ask a follow-up about this passage…"
                  className="min-w-0 flex-1 rounded border border-fz-border bg-fz-bg px-2 py-1 text-xs text-fz-fg outline-none focus-visible:ring-2 focus-visible:ring-fz-accent"
                  aria-label="Follow-up question"
                />
                <button
                  type="submit"
                  disabled={!followUpDraft.trim()}
                  className="rounded border border-fz-border px-2 py-1 text-[10px] hover:bg-fz-bg disabled:opacity-40"
                >
                  Ask
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </aside>
  )
}

// Renders a tutor message body, progressively revealing the latest assistant
// reply (typewriter) so a single mocked completion feels alive. Older messages
// and user messages render instantly (reveal=false).
function TutorMessageBody({
  message,
  reveal
}: {
  message: TutorMessage
  reveal: boolean
}): React.JSX.Element {
  const { display } = useTypewriter({ id: message.id, text: message.content, enabled: reveal })
  return <>{display}</>
}

function ActionChip({
  label,
  onClick,
  disabled
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-fz-border px-2 py-0.5 text-[10px] tracking-wider text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg disabled:cursor-default disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-fz-accent"
    >
      {label}
    </button>
  )
}
