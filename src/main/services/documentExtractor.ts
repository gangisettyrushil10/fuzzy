// Format-agnostic text extraction dispatcher.
//
// Every importable format implements the same contract — given a file path,
// return an `ExtractedDocument` (ordered text sections). The importer and any
// re-index path call `extractDocument(filePath, fileType)` and never branch on
// format themselves.
//
// Foundation status: PDF is fully wired. The other formats throw
// `UnsupportedExtractionError` until their per-format agent lands an extractor
// and flips `extractorReady` in `@shared/formats`. Callers already treat
// extraction failures as non-fatal (the document still imports), so an
// unimplemented format degrades gracefully to "imported but not indexed".

import type { ExtractedDocument } from '@shared/types/database'
import type { FileType } from '@shared/formats'
import { extractAllPages } from './pdfTextExtractor'
import { extractEpub } from './extractors/epubExtractor'
import { extractTxt, extractMarkdown } from './extractors/textExtractor'
import { extractDocx } from './extractors/docxExtractor'
import { extractMobi } from './extractors/mobiExtractor'

export { UnsupportedExtractionError } from './extractors/extractionError'

export async function extractDocument(
  filePath: string,
  fileType: FileType
): Promise<ExtractedDocument> {
  switch (fileType) {
    case 'pdf':
      return extractAllPages(filePath)
    case 'epub':
      return extractEpub(filePath)
    case 'txt':
      return extractTxt(filePath)
    case 'md':
      return extractMarkdown(filePath)
    case 'docx':
      return extractDocx(filePath)
    case 'mobi':
      return extractMobi(filePath)
    default: {
      // Exhaustiveness guard: adding a FileType without a case is a compile error.
      const _never: never = fileType
      throw new Error(`Unhandled file type: ${String(_never)}`)
    }
  }
}
