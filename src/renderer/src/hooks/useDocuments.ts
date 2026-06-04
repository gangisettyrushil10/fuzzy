import { useEffect } from 'react'
import { useDocumentStore } from '../state/documentStore'

// First mount: bootstrap (loads documents AND restores the last-active id).
// Subsequent mounts: noop — the store stays populated.
export function useDocuments(): ReturnType<typeof useDocumentStore.getState> {
  const state = useDocumentStore()
  const { loaded, loading, bootstrap } = state
  useEffect(() => {
    if (!loaded && !loading) {
      bootstrap()
    }
  }, [loaded, loading, bootstrap])
  return state
}
