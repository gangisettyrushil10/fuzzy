import { useSelectionStore } from './state/selectionStore'
import { useAnnotationStore } from './state/annotationStore'

/** Dev/E2E-only hooks on `window.__FUZZY_TEST__`. Not shipped in production builds. */
export function attachTestBridge(): void {
  window.__FUZZY_TEST__ = {
    seedSelection: (input: {
      documentId: string
      pageNumber: number
      text: string
    }) => {
      useSelectionStore.getState().setSelection({
        documentId: input.documentId,
        pageNumber: input.pageNumber,
        text: input.text,
        anchorRect: { top: 200, left: 200, bottom: 220, right: 400 },
        rectsOnPage: [{ x: 0.1, y: 0.2, width: 0.5, height: 0.05 }]
      })
    },
    getAnnotationCount: () => useAnnotationStore.getState().annotations.length
  }
}
