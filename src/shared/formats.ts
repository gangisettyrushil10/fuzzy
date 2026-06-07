// Single source of truth for the file formats Fuzzy can ingest.
//
// Both the main process (native import dialog filters, type detection at
// import time) and the renderer (reader switch, empty-state copy, labels)
// import from here so support for a new format is added in exactly one place.
//
// `readerReady` / `extractorReady` gate the renderer reader-switch and the
// main-process extraction dispatcher respectively. The foundation ships with
// PDF fully wired; the other formats are scaffolded here and lit up by the
// per-format agents. Flipping a flag to `true` is how a format goes live.

export type FileType = 'pdf' | 'epub' | 'txt' | 'md' | 'docx' | 'mobi'

export interface FormatDescriptor {
  type: FileType
  /** Human label used in dialogs and the empty state. */
  label: string
  /** Lowercased extensions WITHOUT the leading dot. */
  extensions: string[]
  /** A renderer reader component exists for this type. */
  readerReady: boolean
  /** A main-process text extractor exists for this type. */
  extractorReady: boolean
  /**
   * Whether this format paginates natively (PDF) or is reflowable
   * (epub/txt/md/docx/mobi). Reflowable formats store their text as ordered
   * "sections" in the `pages` table; the renderer reader paginates them.
   */
  paginated: boolean
}

export const FILE_FORMATS: Record<FileType, FormatDescriptor> = {
  pdf: {
    type: 'pdf',
    label: 'PDF',
    extensions: ['pdf'],
    readerReady: true,
    extractorReady: true,
    paginated: true
  },
  epub: {
    type: 'epub',
    label: 'EPUB',
    extensions: ['epub'],
    readerReady: true,
    extractorReady: true,
    paginated: false
  },
  txt: {
    type: 'txt',
    label: 'Plain text',
    extensions: ['txt'],
    readerReady: true,
    extractorReady: true,
    paginated: false
  },
  md: {
    type: 'md',
    label: 'Markdown',
    extensions: ['md', 'markdown'],
    readerReady: true,
    extractorReady: true,
    paginated: false
  },
  docx: {
    type: 'docx',
    label: 'Word document',
    extensions: ['docx'],
    readerReady: true,
    extractorReady: true,
    paginated: false
  },
  mobi: {
    type: 'mobi',
    label: 'Kindle (MOBI)',
    extensions: ['mobi'],
    readerReady: true,
    extractorReady: true,
    paginated: false
  }
}

export const ALL_FILE_TYPES = Object.keys(FILE_FORMATS) as FileType[]

/** Lowercased extension (no dot) for a path, or '' when there is none. */
export function extensionOf(pathOrName: string): string {
  const base = pathOrName.split(/[\\/]/).pop() ?? pathOrName
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return ''
  return base.slice(dot + 1).toLowerCase()
}

/** Maps a file path/name to a FileType, or null if unsupported. */
export function fileTypeFromPath(pathOrName: string): FileType | null {
  const ext = extensionOf(pathOrName)
  if (!ext) return null
  for (const fmt of Object.values(FILE_FORMATS)) {
    if (fmt.extensions.includes(ext)) return fmt.type
  }
  return null
}

/** Every importable extension across all known formats (for dialog filters). */
export function allImportExtensions(): string[] {
  return Object.values(FILE_FORMATS).flatMap((f) => f.extensions)
}

/** Extensions for formats whose extractor is wired up and shippable today. */
export function readyImportExtensions(): string[] {
  return Object.values(FILE_FORMATS)
    .filter((f) => f.extractorReady)
    .flatMap((f) => f.extensions)
}

export function isFileType(value: unknown): value is FileType {
  return typeof value === 'string' && value in FILE_FORMATS
}
