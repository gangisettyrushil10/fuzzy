import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Mock electron + the documentRepository before importing fileService.
// fileService imports both at module load, so the mocks must register first.
let mockUserDataDir = ''
const repoStub = {
  getDocumentByHash: vi.fn(),
  insertDocument: vi.fn(),
  touchLastOpened: vi.fn()
}

vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => {
      if (key === 'userData') return mockUserDataDir
      throw new Error(`unexpected app.getPath('${key}') in test`)
    }
  },
  dialog: { showOpenDialog: vi.fn() },
  BrowserWindow: class {},
  safeStorage: { isEncryptionAvailable: () => false }
}))

// fileService now transitively imports dbService and pageRepository via
// documentRepository / pdfTextExtractor / setPageCount. Stub the whole
// dbService chain so the test never tries to spin up better-sqlite3 or
// @electron-toolkit/utils.
vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))
vi.mock('../src/main/services/dbService', () => ({
  getDb: () => ({ prepare: () => ({ run: () => undefined, get: () => undefined, all: () => [] }) }),
  initDb: () => undefined,
  closeDb: () => undefined
}))
vi.mock('../src/main/services/pdfTextExtractor', () => ({
  extractAllPages: vi.fn(async () => ({ pageCount: 0, pages: [] })),
  __test: { flattenTextContent: () => '' }
}))
vi.mock('../src/main/db/repositories/pageRepository', () => ({
  upsertPage: vi.fn(),
  bulkUpsertPages: vi.fn(),
  getPageById: vi.fn(),
  listPagesForDocument: vi.fn(() => []),
  getPageByNumber: vi.fn(),
  setComplexityScore: vi.fn()
}))
vi.mock('../src/main/db/repositories/documentRepository', () => ({
  ...repoStub,
  // The new setPageCount import isn't part of repoStub; the test never
  // exercises the import path so a no-op is fine.
  setPageCount: vi.fn(),
  getDocument: vi.fn(),
  listDocuments: vi.fn(() => []),
  deleteDocument: vi.fn()
}))

// Importing after the mocks. The cast-back keeps TS happy.
const { libraryDir, readDocumentBytes, unlinkDocumentFile } =
  await import('../src/main/services/fileService')
const { PathEscapeError } = await import('../src/main/services/pathSafety')

let scratch: string
beforeEach(async () => {
  scratch = await mkdtemp(path.join(tmpdir(), 'fuzzy-file-svc-'))
  mockUserDataDir = scratch
  repoStub.getDocumentByHash.mockReset()
  repoStub.insertDocument.mockReset()
  repoStub.touchLastOpened.mockReset()
})
afterEach(async () => {
  await rm(scratch, { recursive: true, force: true })
})

describe('libraryDir', () => {
  it('lives under app.getPath("userData")', () => {
    expect(libraryDir()).toBe(path.join(scratch, 'library'))
  })
})

describe('readDocumentBytes', () => {
  it('reads bytes for a file inside libraryDir', async () => {
    const dir = libraryDir()
    await rm(dir, { recursive: true, force: true })
    await writeFile(path.join(scratch, 'placeholder'), 'x') // ensure scratch exists
    const { mkdir } = await import('node:fs/promises')
    await mkdir(dir, { recursive: true })
    const filePath = path.join(dir, 'doc.pdf')
    await writeFile(filePath, 'hello pdf bytes')
    const bytes = await readDocumentBytes(filePath)
    expect(bytes.byteLength).toBe('hello pdf bytes'.length)
  })

  it('refuses a path outside libraryDir with PathEscapeError', async () => {
    await expect(readDocumentBytes('/etc/passwd')).rejects.toBeInstanceOf(PathEscapeError)
  })

  it('refuses a path that .. escapes libraryDir', async () => {
    const escape = path.join(libraryDir(), '..', '..', 'etc', 'passwd')
    await expect(readDocumentBytes(escape)).rejects.toBeInstanceOf(PathEscapeError)
  })
})

describe('unlinkDocumentFile', () => {
  it('unlinks a file inside libraryDir', async () => {
    const dir = libraryDir()
    const { mkdir } = await import('node:fs/promises')
    await mkdir(dir, { recursive: true })
    const filePath = path.join(dir, 'doc.pdf')
    await writeFile(filePath, 'hi')
    await unlinkDocumentFile(filePath)
    await expect(stat(filePath)).rejects.toThrow()
  })

  it('silently refuses to unlink a file outside libraryDir', async () => {
    // Create a sibling file that lives outside libraryDir but inside scratch.
    const outside = path.join(scratch, 'not-in-library.txt')
    await writeFile(outside, 'do-not-delete')
    await unlinkDocumentFile(outside) // must not throw, must not delete
    const st = await stat(outside)
    expect(st.isFile()).toBe(true)
  })

  it('is a no-op for a missing file', async () => {
    const dir = libraryDir()
    const { mkdir } = await import('node:fs/promises')
    await mkdir(dir, { recursive: true })
    const ghost = path.join(dir, 'never-existed.pdf')
    await expect(unlinkDocumentFile(ghost)).resolves.toBeUndefined()
  })
})
