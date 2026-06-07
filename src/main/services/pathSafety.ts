import { realpath } from 'fs/promises'
import path from 'path'

// Thrown by guardInsideDir when the resolved target lies outside the trusted root.
// Surface this as a typed error so IPC handlers can return a stable, non-leaky
// response rather than passing the raw FS error to the renderer.
export class PathEscapeError extends Error {
  readonly code = 'EPATH_ESCAPE' as const
  constructor(message: string) {
    super(message)
    this.name = 'PathEscapeError' 
  }
}

// Returns true iff `child` resolves to a path strictly under `root`.
// Pure function — does not touch disk. Used in unit tests + IPC.
export function isInsideDir(root: string, child: string): boolean {
  const normalizedRoot = path.resolve(root)
  const normalizedChild = path.resolve(child)
  if (normalizedRoot === normalizedChild) return false
  const rel = path.relative(normalizedRoot, normalizedChild)
  if (!rel) return false
  if (rel.startsWith('..')) return false
  if (path.isAbsolute(rel)) return false
  return true
}

// Resolve symlinks too — defends against an attacker who plants a symlink
// inside libraryDir that points at /etc/passwd. Falls back to the lexical
// check when the target does not yet exist (fresh imports race with this).
export async function assertInsideDir(root: string, child: string): Promise<string> {
  const lexical = path.resolve(child)
  if (!isInsideDir(root, lexical)) {
    throw new PathEscapeError(`Path ${JSON.stringify(child)} is outside the allowed directory.`)
  }
  let resolved: string
  try {
    resolved = await realpath(lexical)
  } catch {
    // Target doesn't exist yet (or is in the middle of being written). The
    // lexical check above already proved no `..` escape; that's the best we
    // can do without an existing inode.
    return lexical
  }
  const resolvedRoot = await realpath(path.resolve(root)).catch(() => path.resolve(root))
  if (!isInsideDir(resolvedRoot, resolved)) {
    throw new PathEscapeError(
      `Path ${JSON.stringify(child)} resolves outside the allowed directory.`
    )
  }
  return resolved
}
