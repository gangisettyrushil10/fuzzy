import type { AmbientClassification } from '@shared/types/api'
import { getVectors } from '../../db/repositories/embeddingRepository'
import { cosineSimilarity } from '../embeddings/embeddingMock'
import { embedQuery } from '../embeddings/embeddingService'
import { hybridSearchDoc } from '../retrieval/hybridSearch'
import type { SoundtrackQueryPlan } from './soundtrackTypes'

interface SoundtrackSceneAnchor {
  id: string
  lane: string
  description: string
  query: string
}

interface EmbeddedAnchor extends SoundtrackSceneAnchor {
  vector: Float32Array
}

interface EmbeddingSoundtrackInput {
  classification: AmbientClassification
  documentId?: string
  pageNumber?: number
  passageExcerpt: string
  taste: readonly string[]
}

const ANCHOR_LIMIT = 3
const SEARCH_TERM_LIMIT = 120
const anchorCache = new Map<string, Promise<EmbeddedAnchor[]>>()

// These are generic scene descriptions, not song IDs or book-specific rules.
// The visible passage is embedded and semantically ranked against this index;
// Spotify still decides the actual track from its live catalog.
const SOUNDTRACK_SCENE_ANCHORS: SoundtrackSceneAnchor[] = [
  {
    id: 'trapped-desperation',
    lane: 'Trapped desperation',
    description:
      'A character feels trapped by money, social pressure, shame, consequences, or dwindling options and tries to keep panic under control.',
    query: 'tense minimal noir pressure instrumental score'
  },
  {
    id: 'quiet-danger',
    lane: 'Quiet danger',
    description:
      'A low-voiced suspense scene with threat nearby, restrained fear, secrecy, or danger that has not erupted yet.',
    query: 'dark ambient suspense low pulse instrumental'
  },
  {
    id: 'crime-paranoia',
    lane: 'Paranoia',
    description:
      'A character is entangled with crime, guilt, surveillance, suspicion, hiding, betrayal, or being treated as untrustworthy.',
    query: 'noir electronic paranoia suspense instrumental'
  },
  {
    id: 'digital-unease',
    lane: 'Digital unease',
    description:
      'Technology, hacking, virtual systems, machines, screens, networks, artificial intelligence, or digital life create unease or pressure.',
    query: 'minimal cyber noir electronic tension instrumental'
  },
  {
    id: 'domestic-conflict',
    lane: 'Domestic strain',
    description:
      'Family, roommates, partners, or close friends speak through disappointment, worry, silence, obligation, or unresolved conflict.',
    query: 'restrained piano tension intimate instrumental'
  },
  {
    id: 'lonely-reflection',
    lane: 'Lonely reflection',
    description:
      'A reflective internal moment marked by loneliness, regret, uncertainty, identity, memory, or private sadness.',
    query: 'melancholy ambient piano reflective instrumental'
  },
  {
    id: 'grief-loss',
    lane: 'Loss',
    description:
      'A scene centered on death, grief, mourning, absence, heartbreak, goodbye, or the ache of losing someone or something.',
    query: 'slow melancholy piano strings instrumental'
  },
  {
    id: 'romantic-intimacy',
    lane: 'Intimacy',
    description:
      'A close romantic or tender moment with vulnerability, attraction, softness, longing, trust, or emotional closeness.',
    query: 'intimate soft piano warm ambient instrumental'
  },
  {
    id: 'mystery-investigation',
    lane: 'Investigation',
    description:
      'A mystery, clue, secret, puzzle, strange discovery, hidden truth, or careful investigation pulls the scene forward.',
    query: 'mysterious noir jazz minimal instrumental'
  },
  {
    id: 'chase-action',
    lane: 'Pursuit',
    description:
      'Fast movement, pursuit, escape, running, fighting, competition, countdowns, or urgent action with rising adrenaline.',
    query: 'kinetic electronic chase tension instrumental'
  },
  {
    id: 'battle-chaos',
    lane: 'Clash',
    description:
      'Combat, violence, rage, confrontation, attack, war, impact, destruction, or chaotic physical danger dominates the page.',
    query: 'intense cinematic percussion action instrumental'
  },
  {
    id: 'wonder-discovery',
    lane: 'Discovery',
    description:
      'A character encounters beauty, magic, awe, a new world, strange possibility, or a breathtaking discovery.',
    query: 'shimmering ambient wonder cinematic instrumental'
  },
  {
    id: 'pastoral-calm',
    lane: 'Quiet calm',
    description:
      'A peaceful scene with nature, rest, safety, ordinary routine, stillness, or gentle sensory detail.',
    query: 'peaceful acoustic ambient gentle instrumental'
  },
  {
    id: 'urban-night',
    lane: 'City night',
    description:
      'Urban night, streets, apartments, traffic, neon, crowds, rain on windows, alleys, or city isolation shape the mood.',
    query: 'urban noir downtempo night instrumental'
  },
  {
    id: 'hope-resolve',
    lane: 'Resolve',
    description:
      'A character gathers courage, sees a possible way forward, commits to a choice, or finds fragile hope.',
    query: 'hopeful cinematic piano pulse instrumental'
  },
  {
    id: 'social-pressure',
    lane: 'Social pressure',
    description:
      'School, class, reputation, public judgment, embarrassment, status, gossip, competition, or belonging drive the scene.',
    query: 'subtle anxious indie instrumental tension'
  }
]

function cleanTerm(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, SEARCH_TERM_LIMIT)
}

function uniqueTerms(terms: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const term of terms) {
    const clean = cleanTerm(term).toLowerCase()
    if (!clean || seen.has(clean)) continue
    seen.add(clean)
    out.push(clean)
  }
  return out
}

async function getEmbeddedAnchors(model: string): Promise<EmbeddedAnchor[]> {
  let cached = anchorCache.get(model)
  if (!cached) {
    cached = Promise.all(
      SOUNDTRACK_SCENE_ANCHORS.map(async (anchor) => {
        const vector = await embedQuery(anchor.description, model)
        return vector ? { ...anchor, vector } : null
      })
    ).then((items) => items.filter((item): item is EmbeddedAnchor => item != null))
    anchorCache.set(model, cached)
  }
  return cached
}

function buildQueries(
  anchors: readonly SoundtrackSceneAnchor[],
  classification: AmbientClassification,
  taste: readonly string[]
): string[] {
  const energy =
    classification.intensity > 0.72
      ? 'high tension'
      : classification.intensity < 0.28
        ? 'quiet'
        : ''
  return anchors.map((anchor) =>
    cleanTerm(uniqueTerms([taste[0] ?? '', energy, anchor.query]).join(' '))
  )
}

function weightedAverage(vectors: Array<{ vector: Float32Array; weight: number }>): Float32Array | null {
  const first = vectors[0]?.vector
  if (!first) return null
  const out = new Float32Array(first.length)
  let totalWeight = 0
  for (const item of vectors) {
    if (item.vector.length !== out.length || item.weight <= 0) continue
    totalWeight += item.weight
    for (let i = 0; i < out.length; i += 1) out[i] += item.vector[i] * item.weight
  }
  if (totalWeight <= 0) return null
  for (let i = 0; i < out.length; i += 1) out[i] /= totalWeight
  return out
}

export async function planEmbeddingSoundtrackQuery({
  classification,
  documentId,
  pageNumber,
  passageExcerpt,
  taste
}: EmbeddingSoundtrackInput): Promise<SoundtrackQueryPlan | null> {
  const excerpt = passageExcerpt.trim()
  if (!documentId || !excerpt) return null

  const vectors = getVectors(documentId)
  const model = vectors[0]?.model
  if (!model) return null

  const excerptVector = await embedQuery(excerpt, model)
  if (!excerptVector) return null

  const vectorsById = new Map(vectors.map((vector) => [vector.id, vector]))
  let relatedVectors: Float32Array[] = []
  try {
    const passages = await hybridSearchDoc(documentId, excerpt, {
      limit: 3,
      maxPage: typeof pageNumber === 'number' ? pageNumber : null
    })
    relatedVectors = passages
      .filter((passage) => pageNumber == null || passage.pageNumber === pageNumber)
      .map((passage) => vectorsById.get(passage.id)?.vector)
      .filter((vector): vector is Float32Array => vector != null)
  } catch {
    relatedVectors = []
  }

  const sceneVector =
    weightedAverage([
      { vector: excerptVector, weight: 2 },
      ...relatedVectors.map((vector) => ({ vector, weight: 1 }))
    ]) ?? excerptVector

  const anchors = await getEmbeddedAnchors(model)
  if (anchors.length === 0) return null

  const ranked = anchors
    .map((anchor) => ({ anchor, score: cosineSimilarity(sceneVector, anchor.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, ANCHOR_LIMIT)
    .map((entry) => entry.anchor)

  const [primary] = ranked
  if (!primary) return null

  const queries = buildQueries(ranked, classification, taste)
  const [query] = queries
  if (!query) return null

  return {
    lane: primary.lane,
    query,
    queries,
    source: 'embedding'
  }
}

export function clearEmbeddingSoundtrackCache(): void {
  anchorCache.clear()
}
