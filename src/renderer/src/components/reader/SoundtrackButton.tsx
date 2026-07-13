import { useEffect, useState } from 'react'
import type { AmbientClassification } from '@shared/types/api'
import { useSpotifyStore } from '../../state/spotifyStore'
import { cn } from '../../lib/cn'

type SyncStage = 'idle' | 'reading' | 'finding'

// Sits next to Moodlight in the reader toolbar. Manual clicks are deliberately
// stronger than auto mode: each click reclassifies the passage at the current
// scroll position, requests a fresh playlist, and opens that exact result.
export function SoundtrackButton({
  classification,
  feelingEnabled,
  classifyVisiblePassage
}: {
  classification: AmbientClassification | null
  feelingEnabled: boolean
  classifyVisiblePassage: () => Promise<AmbientClassification | null>
}): React.JSX.Element | null {
  const status = useSpotifyStore((s) => s.status)
  const suggestion = useSpotifyStore((s) => s.suggestion)
  const suggestionStatus = useSpotifyStore((s) => s.suggestionStatus)
  const requestSuggestion = useSpotifyStore((s) => s.requestSuggestion)
  const maybeAutoSuggest = useSpotifyStore((s) => s.maybeAutoSuggest)
  const openSuggestion = useSpotifyStore((s) => s.openSuggestion)
  const load = useSpotifyStore((s) => s.load)
  const [syncStage, setSyncStage] = useState<SyncStage>('idle')
  const [scanFailed, setScanFailed] = useState(false)

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!classification || !status?.connected || syncStage !== 'idle') return
    void maybeAutoSuggest(classification)
  }, [classification, status?.connected, syncStage, maybeAutoSuggest])

  if (!status?.connected || !feelingEnabled) return null

  const onClick = async (): Promise<void> => {
    setScanFailed(false)
    setSyncStage('reading')
    const freshClassification = await classifyVisiblePassage()
    if (!freshClassification) {
      setScanFailed(true)
      setSyncStage('idle')
      return
    }

    setSyncStage('finding')
    const freshSuggestion = await requestSuggestion(freshClassification)
    setSyncStage('idle')
    if (freshSuggestion) await openSuggestion(freshSuggestion)
  }

  const manuallySyncing = syncStage !== 'idle'
  const busy = manuallySyncing || suggestionStatus === 'loading'
  const label =
    syncStage === 'reading'
      ? 'Reading scene…'
      : syncStage === 'finding' || suggestionStatus === 'loading'
        ? 'Finding soundtrack…'
        : scanFailed || suggestionStatus === 'error'
          ? 'Try sound again'
          : suggestion?.lane
            ? suggestion.lane
            : suggestionStatus === 'empty'
              ? 'No match'
              : 'Sync sound'

  const title = suggestion
    ? `Rescan this passage and open a new soundtrack. Current match: ${suggestion.name}`
    : 'Read the passage in view and open a matching Spotify soundtrack'

  return (
    <div className="group relative">
      <button
        type="button"
        title={title}
        aria-busy={busy}
        onClick={() => void onClick()}
        disabled={manuallySyncing}
        className={cn(
          'flex max-w-[11rem] items-center gap-1.5 rounded-md border border-fz-border px-2 py-1',
          'text-fz-micro text-fz-fg-muted transition hover:border-fz-fg-subtle/40 hover:text-fz-fg',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fz-accent',
          'disabled:cursor-wait disabled:opacity-60'
        )}
      >
        <span aria-hidden="true">♪</span>
        <span className="truncate" aria-live="polite">
          {label}
        </span>
      </button>

      {suggestion && suggestionStatus === 'ready' && (
        <div
          className={cn(
            'pointer-events-none invisible absolute right-0 top-full z-50 mt-2 w-72 opacity-0',
            'border border-fz-border bg-fz-elevated p-3 shadow-xl transition',
            'group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100',
            'group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100'
          )}
          role="status"
        >
          <div className="flex gap-3">
            {suggestion.imageUrl ? (
              <img
                src={suggestion.imageUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-fz-bg text-fz-fg-subtle">
                <span aria-hidden="true">♪</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase text-fz-fg-subtle">{suggestion.lane}</div>
              <div className="mt-0.5 truncate text-xs font-medium text-fz-fg">
                {suggestion.name ?? 'Spotify playlist'}
              </div>
              {suggestion.ownerName && (
                <div className="mt-0.5 truncate text-[10px] text-fz-fg-muted">
                  by {suggestion.ownerName}
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 truncate text-[10px] text-fz-fg-subtle" title={suggestion.query}>
            Matched: {suggestion.query}
          </div>
          <button
            type="button"
            className="mt-2 flex w-full items-center justify-center gap-1 border border-fz-border px-2 py-1 text-[11px] text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg"
            onClick={() => void openSuggestion(suggestion)}
          >
            Open in Spotify <span aria-hidden="true">↗</span>
          </button>
        </div>
      )}
    </div>
  )
}
