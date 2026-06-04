/// <reference types="vite/client" />

interface FuzzyTestBridge {
  seedSelection: (input: { documentId: string; pageNumber: number; text: string }) => void
  getAnnotationCount: () => number
}

interface Window {
  __FUZZY_TEST__?: FuzzyTestBridge
}
