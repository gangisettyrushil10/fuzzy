import { execFile } from 'node:child_process'
import type {
  SpotifyPlaybackResult,
  SpotifyPlaybackSnapshot,
  SpotifyRestoreResult
} from '@shared/types/api'

const SPOTIFY_TRACK_URI = /^spotify:track:([A-Za-z0-9]+)$/
const COMMAND_TIMEOUT_MS = 60_000

const PLAY_TRACK_SCRIPT = `
on run argv
  set trackUri to item 1 of argv
  set previousUri to ""
  set previousPosition to 0

  tell application id "com.spotify.client"
    try
      set previousUri to spotify url of current track
      set previousPosition to player position
    end try
    play track trackUri
  end tell

  return previousUri & linefeed & (((previousPosition * 1000) as integer) as text)
end run
`

const RESTORE_TRACK_SCRIPT = `
on run argv
  set trackUri to item 1 of argv
  set previousMilliseconds to (item 2 of argv) as integer

  tell application id "com.spotify.client"
    play track trackUri
    delay 0.2
    set player position to (previousMilliseconds / 1000)
  end tell
end run
`

interface CommandResult {
  stdout: string
  stderr: string
}

export type SpotifyCommandRunner = (
  executable: string,
  args: readonly string[]
) => Promise<CommandResult>

export interface SpotifyDesktopOptions {
  platform?: NodeJS.Platform
  runCommand?: SpotifyCommandRunner
}

function runCommand(executable: string, args: readonly string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      executable,
      [...args],
      { encoding: 'utf8', timeout: COMMAND_TIMEOUT_MS },
      (error, stdout, stderr) => {
        if (error) {
          reject(Object.assign(error, { stderr }))
          return
        }
        resolve({ stdout, stderr })
      }
    )
  })
}

function errorText(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const stderr = (error as Error & { stderr?: unknown }).stderr
  return `${error.message} ${typeof stderr === 'string' ? stderr : ''}`.trim()
}

function playbackFailure(error: unknown): Extract<SpotifyPlaybackResult, { ok: false }> {
  const detail = errorText(error)
  if (/(-1743|not authou?rized to send apple events)/i.test(detail)) {
    return {
      ok: false,
      started: false,
      openedExternal: false,
      reason: 'automation-denied',
      message:
        'Allow Fuzzy to control Spotify in System Settings > Privacy & Security > Automation, then try again.'
    }
  }
  if (/(-600|application.*isn.t running|application.*not found)/i.test(detail)) {
    return {
      ok: false,
      started: false,
      openedExternal: false,
      reason: 'spotify-app-unavailable',
      message: 'Install or open the Spotify app on this Mac, then try Soundtrack again.'
    }
  }
  return {
    ok: false,
    started: false,
    openedExternal: false,
    reason: 'playback-unavailable',
    message: 'The Spotify app could not change tracks. Open Spotify once, then try again.'
  }
}

function invalidSuggestion(): Extract<SpotifyPlaybackResult, { ok: false }> {
  return {
    ok: false,
    started: false,
    openedExternal: false,
    reason: 'invalid-suggestion',
    message: 'This soundtrack does not include a playable Spotify track.'
  }
}

function unsupportedPlatform(): Extract<SpotifyPlaybackResult, { ok: false }> {
  return {
    ok: false,
    started: false,
    openedExternal: false,
    reason: 'unsupported-platform',
    message: 'Direct Spotify app control is currently available on macOS.'
  }
}

function snapshotFromOutput(stdout: string): SpotifyPlaybackSnapshot | null {
  const [uri = '', progress = '0'] = stdout.trim().split(/\r?\n/, 2)
  const match = SPOTIFY_TRACK_URI.exec(uri.trim())
  if (!match) return null
  const progressMs = Number(progress.trim())
  return {
    uri: uri.trim(),
    name: null,
    artistName: null,
    imageUrl: null,
    externalUrl: `https://open.spotify.com/track/${match[1]}`,
    progressMs: Number.isFinite(progressMs) ? Math.max(0, Math.round(progressMs)) : 0
  }
}

export async function playSpotifyDesktopTrack(
  uri: string,
  options: SpotifyDesktopOptions = {}
): Promise<SpotifyPlaybackResult> {
  if (!SPOTIFY_TRACK_URI.test(uri)) return invalidSuggestion()
  if ((options.platform ?? process.platform) !== 'darwin') return unsupportedPlatform()

  try {
    const result = await (options.runCommand ?? runCommand)('/usr/bin/osascript', [
      '-e',
      PLAY_TRACK_SCRIPT,
      uri
    ])
    return {
      ok: true,
      started: true,
      openedExternal: false,
      previous: snapshotFromOutput(result.stdout)
    }
  } catch (error) {
    console.warn('[fuzzy spotify] desktop playback failed', errorText(error))
    return playbackFailure(error)
  }
}

export async function restoreSpotifyDesktopTrack(
  snapshot: SpotifyPlaybackSnapshot,
  options: SpotifyDesktopOptions = {}
): Promise<SpotifyRestoreResult> {
  if (!SPOTIFY_TRACK_URI.test(snapshot.uri)) {
    return { ok: false, message: 'The previous Spotify track is no longer available.' }
  }
  if ((options.platform ?? process.platform) !== 'darwin') {
    return { ok: false, message: 'Direct Spotify app control is currently available on macOS.' }
  }

  try {
    await (options.runCommand ?? runCommand)('/usr/bin/osascript', [
      '-e',
      RESTORE_TRACK_SCRIPT,
      snapshot.uri,
      String(Math.max(0, Math.round(snapshot.progressMs)))
    ])
    return { ok: true }
  } catch (error) {
    return { ok: false, message: playbackFailure(error).message }
  }
}

export async function activateSpotifyDesktopApp(
  options: SpotifyDesktopOptions = {}
): Promise<{ ok: boolean; message?: string }> {
  if ((options.platform ?? process.platform) !== 'darwin') {
    return { ok: false, message: 'The Spotify app action is currently available on macOS.' }
  }
  try {
    await (options.runCommand ?? runCommand)('/usr/bin/open', ['-b', 'com.spotify.client'])
    return { ok: true }
  } catch (error) {
    return { ok: false, message: playbackFailure(error).message }
  }
}
