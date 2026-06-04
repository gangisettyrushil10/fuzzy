import { describe, expect, it } from 'vitest'
import { mkdtemp, writeFile, symlink, rm, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { assertInsideDir, isInsideDir, PathEscapeError } from '../src/main/services/pathSafety'

describe('isInsideDir', () => {
  it('accepts a direct child', () => {
    expect(isInsideDir('/a/b', '/a/b/c.pdf')).toBe(true)
  })

  it('accepts a deep descendant', () => {
    expect(isInsideDir('/a/b', '/a/b/c/d/e.pdf')).toBe(true)
  })

  it('rejects the root itself', () => {
    expect(isInsideDir('/a/b', '/a/b')).toBe(false)
  })

  it('rejects siblings', () => {
    expect(isInsideDir('/a/b', '/a/c/file.pdf')).toBe(false)
  })

  it('rejects parent escape with ..', () => {
    expect(isInsideDir('/a/b', '/a/b/../c/file.pdf')).toBe(false)
  })

  it('rejects an absolute path outside the root', () => {
    expect(isInsideDir('/a/b', '/etc/passwd')).toBe(false)
  })

  it('treats unequal but resolution-equivalent roots correctly', () => {
    expect(isInsideDir('/a/b/', '/a/b/c')).toBe(true)
    expect(isInsideDir('/a/b', '/a/b/./c')).toBe(true)
  })
})

describe('assertInsideDir', () => {
  it('returns the resolved path for a child under root', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'fuzzy-pathsafe-'))
    try {
      const file = path.join(root, 'doc.pdf')
      await writeFile(file, 'hello')
      const resolved = await assertInsideDir(root, file)
      // On macOS, /tmp is a symlink to /private/tmp; assertInsideDir
      // realpath-resolves the target, so compare against the realpath of root.
      const realRoot = await realpath(root)
      expect(resolved.startsWith(realRoot)).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('throws PathEscapeError for a path outside the root', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'fuzzy-pathsafe-'))
    try {
      await expect(assertInsideDir(root, '/etc/passwd')).rejects.toBeInstanceOf(PathEscapeError)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects a symlink that points outside the root', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'fuzzy-pathsafe-'))
    const outside = await mkdtemp(path.join(tmpdir(), 'fuzzy-outside-'))
    try {
      const outsideFile = path.join(outside, 'secret.txt')
      await writeFile(outsideFile, 'shh')
      const linkPath = path.join(root, 'evil.pdf')
      await symlink(outsideFile, linkPath)
      await expect(assertInsideDir(root, linkPath)).rejects.toBeInstanceOf(PathEscapeError)
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(outside, { recursive: true, force: true })
    }
  })

  it('falls back to lexical check when the file does not yet exist', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'fuzzy-pathsafe-'))
    try {
      const future = path.join(root, 'about-to-be-written.pdf')
      const resolved = await assertInsideDir(root, future)
      // Lexical fallback returns path.resolve(future), which preserves /tmp
      // vs /private/tmp. Compare lexically.
      expect(resolved).toBe(path.resolve(future))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('uses code === EPATH_ESCAPE on the typed error', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'fuzzy-pathsafe-'))
    try {
      try {
        await assertInsideDir(root, '/etc/passwd')
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(PathEscapeError)
        expect((err as PathEscapeError).code).toBe('EPATH_ESCAPE')
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
