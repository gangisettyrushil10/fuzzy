import { describe, it, expect } from 'vitest'
import {
  buildLocalEntityIndex,
  isLikelyFiction
} from '../src/main/services/entities/entityExtractorMock'
import type { ExtractedDocument } from '../src/shared/types/database'

function page(pageNumber: number, textContent: string): { pageNumber: number; textContent: string } {
  return { pageNumber, textContent }
}

const FICTION = `Elizabeth Bennet walked through the garden. Mr. Darcy watched her from afar.
"Good morning," said Darcy politely. Elizabeth smiled at him. Miss Bennet had not expected Darcy to be so kind.
Elizabeth and Darcy spoke for an hour, and Darcy admired Elizabeth greatly. Elizabeth laughed.`

describe('buildLocalEntityIndex', () => {
  it('extracts characters, clusters aliases, and ranks by salience', () => {
    const entities = buildLocalEntityIndex([page(1, FICTION)])
    const names = entities.map((e) => e.normalizedName)
    // Two characters: an Elizabeth cluster and a Darcy cluster.
    expect(entities.length).toBe(2)
    expect(names.some((n) => n.includes('elizabeth'))).toBe(true)
    expect(names.some((n) => n.includes('darcy'))).toBe(true)
    for (const e of entities) {
      expect(e.mentionCount).toBeGreaterThanOrEqual(2)
      expect(e.salience).toBeGreaterThan(0)
      expect(e.firstPage).toBe(1)
    }
  })

  it('folds first-name/honorific surface forms into one entity', () => {
    const entities = buildLocalEntityIndex([page(1, FICTION)])
    const elizabeth = entities.find((e) => e.normalizedName.includes('elizabeth'))
    expect(elizabeth).toBeDefined()
    // "Elizabeth Bennet" / "Miss Bennet" merge into the Elizabeth entity.
    const aliasBlob = [elizabeth!.name, ...elizabeth!.aliases].join(' ').toLowerCase()
    expect(aliasBlob).toContain('bennet')
  })

  it('drops one-off candidates below the mention threshold', () => {
    const text = `Aaronovich appeared once. Then the road continued past the hills and rivers.`
    const entities = buildLocalEntityIndex([page(1, text)])
    expect(entities.find((e) => e.normalizedName.includes('aaronovich'))).toBeUndefined()
  })
})

describe('isLikelyFiction', () => {
  it('is true for prose with dialogue', () => {
    const doc: ExtractedDocument = { pageCount: 1, pages: [{ ...page(1, FICTION), estimatedWordCount: 60 }] }
    expect(isLikelyFiction(doc)).toBe(true)
  })

  it('is false for academic prose', () => {
    const academic = `Abstract. This paper presents a methodology for analysis. Smith et al. (2019)
    demonstrated the results. See the References section and the bibliography for the hypothesis details.`
    const doc: ExtractedDocument = {
      pageCount: 1,
      pages: [{ pageNumber: 1, textContent: academic, estimatedWordCount: 40 }]
    }
    expect(isLikelyFiction(doc)).toBe(false)
  })
})
