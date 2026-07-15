import { describe, expect, it, vi } from 'vitest'
import type { SpotifyPlaybackSnapshot } from '../src/shared/types/api'
import {
  activateSpotifyDesktopApp,
  playSpotifyDesktopTrack,
  restoreSpotifyDesktopTrack,
  type SpotifyCommandRunner
} from '../src/main/services/spotify/spotifyDesktopPlayer'

describe('Spotify desktop player', () => {
  it('passes a validated track URI as an osascript argument and captures Undo state', async () => {
    const calls: Array<{ executable: string; args: readonly string[] }> = []
    const runner: SpotifyCommandRunner = async (executable, args) => {
      calls.push({ executable, args })
      return { stdout: 'spotify:track:previous\n42123\n', stderr: '' }
    }

    const result = await playSpotifyDesktopTrack('spotify:track:new123', {
      platform: 'darwin',
      runCommand: runner
    })

    expect(result).toMatchObject({
      ok: true,
      started: true,
      openedExternal: false,
      previous: { uri: 'spotify:track:previous', progressMs: 42_123 }
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].executable).toBe('/usr/bin/osascript')
    expect(calls[0].args.at(-1)).toBe('spotify:track:new123')
    expect(calls[0].args[1]).not.toContain('spotify:track:new123')
  })

  it('rejects malformed URIs before executing a command', async () => {
    const runner = vi.fn()

    const result = await playSpotifyDesktopTrack('https://open.spotify.com/track/not-native', {
      platform: 'darwin',
      runCommand: runner
    })

    expect(result).toMatchObject({ ok: false, reason: 'invalid-suggestion' })
    expect(runner).not.toHaveBeenCalled()
  })

  it('turns denied Apple Events access into an actionable message', async () => {
    const runner: SpotifyCommandRunner = async () => {
      throw new Error('Not authorized to send Apple events. (-1743)')
    }
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = await playSpotifyDesktopTrack('spotify:track:allowed', {
      platform: 'darwin',
      runCommand: runner
    })

    expect(result).toMatchObject({ ok: false, reason: 'automation-denied' })
    expect(result.ok || result.message).toContain('Privacy & Security > Automation')
  })

  it('restores the previous URI and playback position through Spotify', async () => {
    const calls: Array<{ executable: string; args: readonly string[] }> = []
    const runner: SpotifyCommandRunner = async (executable, args) => {
      calls.push({ executable, args })
      return { stdout: '', stderr: '' }
    }
    const snapshot: SpotifyPlaybackSnapshot = {
      uri: 'spotify:track:previous',
      name: null,
      artistName: null,
      imageUrl: null,
      externalUrl: null,
      progressMs: 42_123
    }

    const result = await restoreSpotifyDesktopTrack(snapshot, {
      platform: 'darwin',
      runCommand: runner
    })

    expect(result).toEqual({ ok: true })
    expect(calls[0].args.slice(-2)).toEqual(['spotify:track:previous', '42123'])
  })

  it('reveals the Spotify app without opening a web URL', async () => {
    const calls: Array<{ executable: string; args: readonly string[] }> = []
    const runner: SpotifyCommandRunner = async (executable, args) => {
      calls.push({ executable, args })
      return { stdout: '', stderr: '' }
    }

    const result = await activateSpotifyDesktopApp({ platform: 'darwin', runCommand: runner })

    expect(result).toEqual({ ok: true })
    expect(calls).toEqual([{ executable: '/usr/bin/open', args: ['-b', 'com.spotify.client'] }])
  })
})
