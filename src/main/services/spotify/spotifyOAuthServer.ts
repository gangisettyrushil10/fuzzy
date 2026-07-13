import { createServer, type Server } from 'http'
import { SPOTIFY_LOOPBACK_PORT } from './spotifyOAuth'

const CALLBACK_TIMEOUT_MS = 120_000

const PAGE_OK = `<!doctype html><html><body style="font:15px -apple-system,sans-serif;padding:2rem;color:#111">
<p>Spotify connected. You can close this tab and return to Fuzzy.</p></body></html>`

const PAGE_ERROR = (message: string): string =>
  `<!doctype html><html><body style="font:15px -apple-system,sans-serif;padding:2rem;color:#111">
<p>Spotify connection failed: ${message}. You can close this tab and return to Fuzzy.</p></body></html>`

// Waits for exactly one redirect to http://127.0.0.1:<port>/callback, then
// tears the server down. Only one connect attempt can be in flight at a time.
export function waitForOAuthCallback(expectedState: string): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    let settled = false
    let server: Server | null = null

    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      server?.close()
      fn()
    }

    const timer = setTimeout(() => {
      finish(() => reject(new Error('Timed out waiting for Spotify to redirect back to Fuzzy.')))
    }, CALLBACK_TIMEOUT_MS)

    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${SPOTIFY_LOOPBACK_PORT}`)
      if (url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }

      const error = url.searchParams.get('error')
      const state = url.searchParams.get('state')
      const code = url.searchParams.get('code')

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' }).end(PAGE_ERROR(error))
        finish(() => reject(new Error(`Spotify denied access (${error}).`)))
        return
      }
      if (state !== expectedState || !code) {
        res.writeHead(200, { 'Content-Type': 'text/html' }).end(PAGE_ERROR('invalid response'))
        finish(() => reject(new Error('Spotify callback failed a state/code check.')))
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html' }).end(PAGE_OK)
      finish(() => resolve({ code }))
    })

    server.on('error', (err) => {
      finish(() =>
        reject(
          err instanceof Error &&
            'code' in err &&
            (err as NodeJS.ErrnoException).code === 'EADDRINUSE'
            ? new Error(
                `Port ${SPOTIFY_LOOPBACK_PORT} is already in use — close whatever is using it and try again.`
              )
            : err
        )
      )
    })

    server.listen(SPOTIFY_LOOPBACK_PORT, '127.0.0.1')
  })
}
