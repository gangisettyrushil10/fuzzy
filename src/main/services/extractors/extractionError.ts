import { FILE_FORMATS, type FileType } from '@shared/formats'

// Thrown by a format extractor that isn't implemented (or can't handle a given
// file). Import flow treats extraction failures as non-fatal, so this degrades
// to "imported but not indexed" rather than blocking the import.
export class UnsupportedExtractionError extends Error {
  constructor(public readonly fileType: FileType) {
    super(`No extractor implemented yet for "${FILE_FORMATS[fileType].label}" (${fileType}).`)
    this.name = 'UnsupportedExtractionError'
  }
}
