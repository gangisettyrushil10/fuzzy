import { useEffect, useState } from 'react'
import type { EntityRecord } from '@shared/types/database'

// Load the character/entity roster for a document (the entity index built at
// import). Shared by the evidence Cast section and the @-mention picker.
export function useDocumentEntities(documentId: string | null): EntityRecord[] {
  const [entities, setEntities] = useState<EntityRecord[]>([])
  useEffect(() => {
    let cancelled = false
    if (!documentId) {
      setEntities([])
      return
    }
    window.fuzzy.entities
      .list(documentId)
      .then((list) => {
        if (!cancelled) setEntities(list)
      })
      .catch(() => {
        if (!cancelled) setEntities([])
      })
    return () => {
      cancelled = true
    }
  }, [documentId])
  return entities
}
