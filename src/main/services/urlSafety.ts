// Centralised scheme check for external URL opens.
//
// `shell.openExternal` will happily hand a URL to the macOS LaunchServices
// resolver, which can map exotic schemes (e.g. `file://`, `javascript:`,
// `vscode://`, `slack://`) to local apps. We only want classic web/email
// links to reach the OS — anything else is dropped silently.

const ALLOWED_EXTERNAL_SCHEMES = new Set(['http:', 'https:', 'mailto:'])

// Exported so unit tests can exercise the predicate without spinning up the
// Electron `shell` module.
export function isAllowedExternalScheme(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ALLOWED_EXTERNAL_SCHEMES.has(parsed.protocol)
  } catch {
    return false
  }
}
