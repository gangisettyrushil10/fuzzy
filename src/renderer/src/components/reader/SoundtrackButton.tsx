import { useEffect, useState } from 'react'
import type { AmbientClassification } from '@shared/types/api'
import { useSpotifyStore } from '../../state/spotifyStore'
import { cn } from '../../lib/cn'

type SyncStage = 'idle' | 'reading' | 'finding'

export interface VisiblePassageClassification {
  classification: AmbientClassification
  excerpt: string
}

// A manual press means the current music is not fitting. Re-read the visible
// passage, avoid recently rejected tracks, and start the replacement at once.
export function SoundtrackButton({
  classification,
  feelingEnabled,
  classifyVisiblePassage
}: {
  classification: AmbientClassification | null
  feelingEnabled: boolean
  classifyVisiblePassage: () => Promise<VisiblePassageClassification | null>
}): React.JSX.Element | null {
  const status = useSpotifyStore((s) => s.status)
  const suggestion = useSpotifyStore((s) => s.suggestion)
  const suggestionStatus = useSpotifyStore((s) => s.suggestionStatus)
  const playbackState = useSpotifyStore((s) => s.playbackState)
  const playbackMessage = useSpotifyStore((s) => s.playbackMessage)
  const undoSnapshot = useSpotifyStore((s) => s.undoSnapshot)
  const soundtrackPassage = useSpotifyStore((s) => s.soundtrackPassage)
  const maybeAutoSuggest = useSpotifyStore((s) => s.maybeAutoSuggest)
  const undoLastSwap = useSpotifyStore((s) => s.undoLastSwap)
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
    const visiblePassage = await classifyVisiblePassage()
    if (!visiblePassage) {
      setScanFailed(true)
      setSyncStage('idle')
      return
    }

    setSyncStage('finding')
    await soundtrackPassage(visiblePassage.classification, visiblePassage.excerpt)
    setSyncStage('idle')
  }

  const manuallySyncing = syncStage !== 'idle'
  const busy = manuallySyncing || suggestionStatus === 'loading' || playbackState === 'starting'
  const label =
    syncStage === 'reading'
      ? 'Reading this moment…'
      : syncStage === 'finding' || suggestionStatus === 'loading'
        ? 'Finding a track…'
        : playbackState === 'starting'
          ? 'Starting track…'
          : scanFailed || suggestionStatus === 'error'
            ? 'Try sound again'
            : playbackState === 'playing' && suggestion?.name
              ? suggestion.name
              : suggestionStatus === 'empty'
                ? 'No match'
                : 'Soundtrack'

  const title = suggestion
    ? `Not fitting? Click to replace ${suggestion.name ?? 'this track'} for the passage in view.`
    : 'Read the passage in view and immediately start a matching Spotify track'

  return (
    <div className="group relative">
      <button
        type="button"
        title={title}
        aria-busy={busy}
        onClick={() => void onClick()}
        disabled={busy}
        className={cn(
          'flex max-w-[11rem] items-center gap-1.5 rounded-md border border-fz-border px-2 py-1',
          'text-fz-micro text-fz-fg-muted transition hover:border-fz-fg-subtle/40 hover:text-fz-fg',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fz-accent',
          'disabled:cursor-wait disabled:opacity-60',
          playbackState === 'playing' && 'border-fz-accent/45 bg-fz-accent/10 text-fz-fg'
        )}
      >
        <span
          className="relative flex h-3 w-3 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          <span>♪</span>
          {playbackState === 'playing' && (
            <span className="absolute inset-0 rounded-full bg-fz-accent/35 animate-ping" />
          )}
        </span>
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
                {suggestion.name ?? 'Spotify track'}
              </div>
              {suggestion.artistName && (
                <div className="mt-0.5 truncate text-[10px] text-fz-fg-muted">
                  {suggestion.artistName}
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-fz-fg-subtle">
            <span className="truncate" title={suggestion.query}>
              {suggestion.querySource === 'openai' ? 'AI-scored' : 'Scored'} for {suggestion.lane}
            </span>
            {playbackState === 'playing' && (
              <span className="shrink-0 text-fz-success">Playing</span>
            )}
          </div>
          {playbackMessage && (
            <div className="mt-1.5 text-[10px] leading-relaxed text-fz-fg-muted" aria-live="polite">
              {playbackMessage}
            </div>
          )}
          <div className="mt-2 flex gap-1.5">
            {undoSnapshot && (
              <button
                type="button"
                className="flex-1 border border-fz-border px-2 py-1 text-[11px] text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg"
                onClick={() => void undoLastSwap()}
              >
                Undo
              </button>
            )}
            <button
              type="button"
              className="flex-1 border border-fz-border px-2 py-1 text-[11px] text-fz-fg-muted hover:bg-fz-bg hover:text-fz-fg"
              onClick={() => void openSuggestion(suggestion)}
            >
              Show Spotify
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
