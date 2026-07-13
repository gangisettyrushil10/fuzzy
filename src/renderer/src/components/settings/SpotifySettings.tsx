import { useEffect, useState } from 'react'
import { useSpotifyStore } from '../../state/spotifyStore'
import type { SpotifyPlaybackMode } from '@shared/types/api'
import { Button, Input, SegmentedControl, Section } from '../ui'
import { cn } from '../../lib/cn'
import { toast } from '../../state/toastStore'

// Curated taste tags layered onto every mood search (see moodMusicMap.ts on
// the main side) so results skew toward genres the user actually likes.
// Single-select by design — "peaceful piano ambient" plus one flavor reads
// naturally as a search query; stacking several would just dilute it.
const TASTE_TAGS = [
  'lo-fi',
  'classical',
  'jazz',
  'electronic',
  'acoustic',
  'orchestral',
  'synthwave',
  'folk'
]

export function SpotifySettings(): React.JSX.Element {
  const status = useSpotifyStore((s) => s.status)
  const load = useSpotifyStore((s) => s.load)
  const setClientId = useSpotifyStore((s) => s.setClientId)
  const connect = useSpotifyStore((s) => s.connect)
  const disconnect = useSpotifyStore((s) => s.disconnect)
  const setPlaybackMode = useSpotifyStore((s) => s.setPlaybackMode)
  const setGenrePreferences = useSpotifyStore((s) => s.setGenrePreferences)

  const [clientIdInput, setClientIdInput] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void load()
  }, [load])

  if (!status) {
    return <div className="text-fz-ui text-fz-fg-muted">Loading…</div>
  }

  const onSaveClientId = async (): Promise<void> => {
    const trimmed = clientIdInput.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      await setClientId(trimmed)
      setClientIdInput('')
      toast.success('Client ID saved.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save Client ID')
    } finally {
      setBusy(false)
    }
  }

  const onConnect = async (): Promise<void> => {
    setBusy(true)
    try {
      const result = await connect()
      if (result.ok) {
        toast.success('Connected to Spotify.')
      } else {
        toast.error(result.error ?? 'Failed to connect to Spotify.')
      }
    } finally {
      setBusy(false)
    }
  }

  const onDisconnect = async (): Promise<void> => {
    setBusy(true)
    try {
      await disconnect()
      toast.success('Disconnected from Spotify.')
    } finally {
      setBusy(false)
    }
  }

  const toggleTaste = async (tag: string): Promise<void> => {
    const current = status.genrePreferences
    const next = current[0] === tag ? [] : [tag]
    await setGenrePreferences(next)
  }

  return (
    <div className="space-y-6">
      <Section
        title="Spotify Ambient Companion"
        description="Moodlight reads the passage in view, finds a matching track, and controls your existing Spotify player. Fuzzy never receives or streams audio itself."
      >
        <div className="space-y-3">
          <div>
            <span className="text-fz-ui text-fz-fg-muted">1. Spotify Client ID</span>
            <p className="mt-0.5 text-fz-micro leading-relaxed text-fz-fg-subtle">
              Create a free app at{' '}
              <span className="text-fz-fg">developer.spotify.com/dashboard</span>, add redirect URI{' '}
              <code>http://127.0.0.1:51821/callback</code> exactly, then paste its Client ID below.
              No Client Secret is needed or used.
            </p>
            <div className="mt-1.5 flex gap-2">
              <Input
                placeholder="Spotify Client ID"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
              />
              <Button
                variant="primary"
                onClick={() => void onSaveClientId()}
                disabled={busy || clientIdInput.trim().length === 0}
              >
                Save
              </Button>
            </div>
            <p className="mt-1 text-fz-micro text-fz-fg-subtle">
              {status.configured ? 'Client ID on file.' : 'No Client ID saved yet.'}
            </p>
          </div>

          <div>
            <span className="text-fz-ui text-fz-fg-muted">2. Account</span>
            <div className="mt-1.5 flex items-center gap-2">
              {status.connected ? (
                <>
                  <span className={cn('h-2 w-2 rounded-full', 'bg-fz-success')} />
                  <span className="text-fz-ui text-fz-fg">
                    {status.playbackControl ? 'Connected for playback' : 'Connected for search'}
                  </span>
                  {!status.playbackControl && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="ml-auto"
                      onClick={() => void onConnect()}
                      disabled={busy}
                    >
                      Reconnect for playback
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className={status.playbackControl ? 'ml-auto' : undefined}
                    onClick={() => void onDisconnect()}
                    disabled={busy}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => void onConnect()}
                  disabled={busy || !status.configured}
                >
                  Connect Spotify
                </Button>
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Playback mode"
        description="Manual changes the track whenever you press Soundtrack. Auto companion also re-scores meaningful mood, scene, and intensity shifts after a calm cooldown."
      >
        <SegmentedControl<SpotifyPlaybackMode>
          aria-label="Spotify playback mode"
          value={status.playbackMode}
          onChange={(v) => void setPlaybackMode(v)}
          options={[
            { value: 'suggest', label: 'Manual' },
            { value: 'auto', label: 'Auto companion' }
          ]}
        />
      </Section>

      <Section title="Taste" description="Bias suggestions toward a genre you like — optional.">
        <div className="flex flex-wrap gap-1.5">
          {TASTE_TAGS.map((tag) => {
            const selected = status.genrePreferences[0] === tag
            return (
              <button
                key={tag}
                type="button"
                onClick={() => void toggleTaste(tag)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-fz-ui transition',
                  selected
                    ? 'border-fz-accent bg-fz-accent/15 text-fz-fg'
                    : 'border-fz-border text-fz-fg-muted hover:border-fz-fg-subtle/40 hover:text-fz-fg'
                )}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </Section>

      <p className="text-fz-micro leading-relaxed text-fz-fg-subtle">
        One-click control uses Spotify Connect and requires Spotify Premium plus an available
        device. When direct control is unavailable, Fuzzy opens the chosen track in Spotify instead.
        Fuzzy never requests access to your library or playlists.
      </p>
    </div>
  )
}
