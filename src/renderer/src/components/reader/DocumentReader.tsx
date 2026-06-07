import { useMemo } from 'react'
import { useDocumentStore } from '../../state/documentStore'
import { PdfReader } from '../pdf/PdfReader'
import { ReflowableReader } from './ReflowableReader'
import { UnsupportedReader } from './UnsupportedReader'

// Format-aware reader switch. AppShell renders this for the active document;
// it picks the right reader based on `fileType`. Per-format agents add a case
// here (importing their own reader component) and flip `readerReady` in
// '@shared/formats'. Until then, formats fall through to UnsupportedReader.
export function DocumentReader({ documentId }: { documentId: string }): React.JSX.Element {
  const documents = useDocumentStore((s) => s.documents)
  const doc = useMemo(
    () => documents.find((d) => d.id === documentId) ?? null,
    [documents, documentId]
  )

  if (!doc) {
    // Document list hasn't hydrated yet; PdfReader-style shell handles its own
    // loading, so render nothing structural here.
    return <UnsupportedReader title={undefined} fileType={null} />
  }

  switch (doc.fileType) {
    case 'pdf':
      return <PdfReader key={documentId} documentId={documentId} />
    // All reflowable formats share one reader; it renders the sections that
    // each format's main-process extractor produces.
    case 'epub':
    case 'txt':
    case 'md':
    case 'docx':
    case 'mobi':
      return <ReflowableReader key={documentId} documentId={documentId} fileType={doc.fileType} />
    default:
      return <UnsupportedReader title={doc.title} fileType={doc.fileType} />
  }
}
