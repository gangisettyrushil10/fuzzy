import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Shared, hoisted mock state so the vi.mock factories (hoisted above imports) can
// reach it. Lets us drive the service with an in-memory prefs blob + doc titles
// while exercising the REAL filesystem writes in a temp vault.
const mock = vi.hoisted(() => ({
  prefs: { vaultPath: null as string | null, subfolder: 'Fuzzy', notePaths: {} as Record<string, string> },
  titles: {} as Record<string, string>
}))

vi.mock('electron', () => ({
  dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) }
}))

vi.mock('../src/main/services/settingsService', () => ({
  readObsidianPrefs: () => mock.prefs,
  writeObsidianPrefs: (patch: Record<string, unknown>) => {
    mock.prefs = { ...mock.prefs, ...patch } as typeof mock.prefs
    return mock.prefs
  }
}))

vi.mock('../src/main/db/repositories/documentRepository', () => ({
  getDocument: (id: string) => (mock.titles[id] ? { id, title: mock.titles[id] } : null)
}))

import {
  appendNoteForDocument,
  getObsidianStatus,
  readNoteForDocument,
  writeNoteForDocument,
  ObsidianVaultMissingError
} from '../src/main/services/obsidianService'

let vault: string

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'fuzzy-vault-'))
  mock.prefs = { vaultPath: vault, subfolder: 'Fuzzy', notePaths: {} }
  mock.titles = { docA: 'Attention Is All You Need', docB: 'Attention Is All You Need' }
})

afterEach(async () => {
  await rm(vault, { recursive: true, force: true })
})

describe('obsidianService', () => {
  it('reports connected status when a vault is set', () => {
    expect(getObsidianStatus()).toEqual({ vaultPath: vault, subfolder: 'Fuzzy', connected: true })
  })

  it('writes a note into <vault>/Fuzzy/<slug>.md and reads it back', async () => {
    await writeNoteForDocument('docA', '# My notes\n\nmessage passing is key')
    const file = join(vault, 'Fuzzy', 'Attention Is All You Need.md')
    expect(existsSync(file)).toBe(true)
    expect(await readFile(file, 'utf-8')).toBe('# My notes\n\nmessage passing is key')
    expect(await readNoteForDocument('docA')).toBe('# My notes\n\nmessage passing is key')
  })

  it('returns empty string for a document with no note file yet', async () => {
    expect(await readNoteForDocument('docA')).toBe('')
  })

  it('appends blocks with a blank-line separator', async () => {
    await writeNoteForDocument('docA', 'first line')
    await appendNoteForDocument('docA', '## Highlight\n\n> quoted text')
    const content = await readNoteForDocument('docA')
    expect(content).toBe('first line\n\n## Highlight\n\n> quoted text\n')
  })

  it('appends cleanly even when the note file does not exist yet', async () => {
    await appendNoteForDocument('docA', '## Note (AI)\n\nhello')
    expect(await readNoteForDocument('docA')).toBe('## Note (AI)\n\nhello\n')
  })

  it('gives two same-titled documents distinct files (dedupe)', async () => {
    await writeNoteForDocument('docA', 'A notes')
    await writeNoteForDocument('docB', 'B notes')
    expect(mock.prefs.notePaths.docA).toBe('Attention Is All You Need.md')
    expect(mock.prefs.notePaths.docB).toBe('Attention Is All You Need-2.md')
    expect(await readNoteForDocument('docA')).toBe('A notes')
    expect(await readNoteForDocument('docB')).toBe('B notes')
  })

  it('reuses the persisted mapping across calls (stable filename)', async () => {
    await writeNoteForDocument('docA', 'v1')
    await writeNoteForDocument('docA', 'v2')
    expect(mock.prefs.notePaths.docA).toBe('Attention Is All You Need.md')
    expect(await readNoteForDocument('docA')).toBe('v2')
  })

  it('adopts an existing unmapped file of the same slug (reconnect)', async () => {
    // Simulate a note left in the vault from a previous session with no mapping.
    await mkdir(join(vault, 'Fuzzy'), { recursive: true })
    await writeNoteForDocument('docA', 'reconnected')
    // First doc with this slug adopts the plain name rather than spawning `-2`.
    expect(mock.prefs.notePaths.docA).toBe('Attention Is All You Need.md')
  })

  it('throws ObsidianVaultMissingError when no vault is configured', async () => {
    mock.prefs = { vaultPath: null, subfolder: 'Fuzzy', notePaths: {} }
    await expect(readNoteForDocument('docA')).rejects.toBeInstanceOf(ObsidianVaultMissingError)
  })
})
