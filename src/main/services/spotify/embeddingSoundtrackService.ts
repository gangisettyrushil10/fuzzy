import type { AmbientClassification } from '@shared/types/api'
import { getVectors } from '../../db/repositories/embeddingRepository'
import { cosineSimilarity } from '../embeddings/embeddingMock'
import { embedQuery } from '../embeddings/embeddingService'
import type { SoundtrackQueryPlan } from './soundtrackTypes'

interface SoundtrackSceneAnchor {
  id: string
  lane: string
  description: string
  query: string
}

interface SoundtrackPaletteAnchor {
  id: string
  label: string
  description: string
  query: string
}

interface EmbeddedAnchor<T> {
  item: T
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
const PALETTE_LIMIT = 2
const SEARCH_TERM_LIMIT = 120
const CONTEXT_VECTOR_LIMIT = 7
const BOOK_VECTOR_SAMPLE_LIMIT = 180
const sceneAnchorCache = new Map<string, Promise<Array<EmbeddedAnchor<SoundtrackSceneAnchor>>>>()
const paletteAnchorCache = new Map<string, Promise<Array<EmbeddedAnchor<SoundtrackPaletteAnchor>>>>()

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

const SOUNDTRACK_PALETTE_ANCHORS: SoundtrackPaletteAnchor[] = [
  {
    id: 'digital-gaming',
    label: 'Cyber lofi',
    description:
      'A contemporary or futuristic story world of gaming, virtual reality, hacking, code, devices, screens, neon cities, online identities, esports, or digital systems.',
    query: 'downtempo electronic lofi beats cyber instrumental focus'
  },
  {
    id: 'orchestral-fantasy',
    label: 'Orchestral fantasy',
    description:
      'A magical or mythic story world with schools of magic, castles, spells, wands, ancient halls, quests, enchanted objects, creatures, prophecy, or wonder.',
    query: 'orchestral fantasy strings celesta instrumental score'
  },
  {
    id: 'space-sci-fi',
    label: 'Space ambient',
    description:
      'A science fiction world of space travel, planets, ships, galaxies, robots, androids, alien contact, laboratories, or cosmic scale.',
    query: 'ambient sci fi synth cinematic instrumental focus'
  },
  {
    id: 'urban-noir',
    label: 'Urban noir',
    description:
      'A city-centered story world with apartments, streets, alleys, rain, crime, surveillance, money pressure, nightlife, secrets, or moral ambiguity.',
    query: 'urban noir downtempo jazz electronic instrumental'
  },
  {
    id: 'gothic-mystery',
    label: 'Gothic mystery',
    description:
      'A gothic, haunted, secretive, or mysterious world with old houses, shadows, fog, locked rooms, ghosts, curses, hidden histories, or dread.',
    query: 'dark chamber strings gothic mystery instrumental'
  },
  {
    id: 'historical-chamber',
    label: 'Historical chamber',
    description:
      'A historical or period story world with courts, estates, villages, letters, society, old customs, war memories, or classical manners.',
    query: 'chamber strings classical piano instrumental reading'
  },
  {
    id: 'romantic-indie',
    label: 'Soft indie',
    description:
      'A contemporary intimate world of relationships, longing, friendship, school, family, vulnerability, tenderness, or ordinary emotional life.',
    query: 'soft indie instrumental lofi guitar piano'
  },
  {
    id: 'adventure-cinematic',
    label: 'Cinematic adventure',
    description:
      'An adventurous world of travel, quests, maps, wilderness, danger, discovery, competition, survival, or fast movement.',
    query: 'cinematic adventure percussion strings instrumental'
  },
  {
    id: 'literary-minimal',
    label: 'Minimal literary',
    description:
      'A quiet literary world focused on interior thought, memory, ordinary rooms, family, silence, private conflict, or restrained emotion.',
    query: 'minimal piano ambient reflective instrumental'
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

async function getEmbeddedSceneAnchors(
  model: string
): Promise<Array<EmbeddedAnchor<SoundtrackSceneAnchor>>> {
  let cached = sceneAnchorCache.get(model)
  if (!cached) {
    cached = Promise.all(
      SOUNDTRACK_SCENE_ANCHORS.map(async (anchor) => {
        const vector = await embedQuery(anchor.description, model)
        return vector ? { item: anchor, vector } : null
      })
    ).then((items) =>
      items.filter((item): item is EmbeddedAnchor<SoundtrackSceneAnchor> => item != null)
    )
    sceneAnchorCache.set(model, cached)
  }
  return cached
}

async function getEmbeddedPaletteAnchors(
  model: string
): Promise<Array<EmbeddedAnchor<SoundtrackPaletteAnchor>>> {
  let cached = paletteAnchorCache.get(model)
  if (!cached) {
    cached = Promise.all(
      SOUNDTRACK_PALETTE_ANCHORS.map(async (anchor) => {
        const vector = await embedQuery(anchor.description, model)
        return vector ? { item: anchor, vector } : null
      })
    ).then((items) =>
      items.filter((item): item is EmbeddedAnchor<SoundtrackPaletteAnchor> => item != null)
    )
    paletteAnchorCache.set(model, cached)
  }
  return cached
}

function buildQueries(
  scenes: readonly SoundtrackSceneAnchor[],
  palettes: readonly SoundtrackPaletteAnchor[],
  classification: AmbientClassification,
  taste: readonly string[]
): string[] {
  const energy =
    classification.intensity > 0.72
      ? 'high tension'
      : classification.intensity < 0.28
        ? 'quiet'
        : ''
  const medium = palettes[0]?.query ?? 'instrumental reading focus'
  const pairs: string[] = []
  for (const scene of scenes) {
    pairs.push(
      cleanTerm(
        uniqueTerms([taste[0] ?? '', energy, medium, scene.query, 'reading instrumental']).join(
          ' '
        )
      )
    )
  }
  for (const palette of palettes.slice(1)) {
    pairs.push(
      cleanTerm(
        uniqueTerms([taste[0] ?? '', energy, palette.query, scenes[0]?.query ?? '']).join(' ')
      )
    )
  }
  return pairs
}

function weightedAverage(
  vectors: Array<{ vector: Float32Array; weight: number }>
): Float32Array | null {
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

function sampledVectors(vectors: readonly Float32Array[], limit: number): Float32Array[] {
  if (vectors.length <= limit) return [...vectors]
  const out: Float32Array[] = []
  const step = (vectors.length - 1) / (limit - 1)
  for (let i = 0; i < limit; i += 1) out.push(vectors[Math.round(i * step)])
  return out
}

function nearestVectors(
  vectors: Array<{ vector: Float32Array; pageNumber: number }>,
  query: Float32Array,
  pageNumber?: number
): Float32Array[] {
  return vectors
    .map((item) => {
      const pagePenalty =
        typeof pageNumber === 'number'
          ? Math.min(0.08, Math.abs(item.pageNumber - pageNumber) * 0.01)
          : 0
      return { vector: item.vector, score: cosineSimilarity(query, item.vector) - pagePenalty }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, CONTEXT_VECTOR_LIMIT)
    .map((item) => item.vector)
}

function rankAnchors<T>(
  anchors: Array<EmbeddedAnchor<T>>,
  vector: Float32Array,
  limit: number
): T[] {
  return anchors
    .map((anchor) => ({ item: anchor.item, score: cosineSimilarity(vector, anchor.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item)
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

  const relatedVectors = nearestVectors(vectors, excerptVector, pageNumber)

  const sceneVector =
    weightedAverage([
      { vector: excerptVector, weight: 3 },
      ...relatedVectors.map((vector) => ({ vector, weight: 1 }))
    ]) ?? excerptVector

  const bookSamples = sampledVectors(
    vectors.map((vector) => vector.vector),
    BOOK_VECTOR_SAMPLE_LIMIT
  )
  const bookWorldVector =
    weightedAverage(bookSamples.map((vector) => ({ vector, weight: 1 }))) ?? sceneVector

  const paletteVector =
    weightedAverage([
      { vector: bookWorldVector, weight: 2 },
      { vector: sceneVector, weight: 1 }
    ]) ?? bookWorldVector

  const sceneAnchors = await getEmbeddedSceneAnchors(model)
  const paletteAnchors = await getEmbeddedPaletteAnchors(model)
  if (sceneAnchors.length === 0 || paletteAnchors.length === 0) return null

  const rankedScenes = rankAnchors(sceneAnchors, sceneVector, ANCHOR_LIMIT)
  const rankedPalettes = rankAnchors(paletteAnchors, paletteVector, PALETTE_LIMIT)

  const [primaryScene] = rankedScenes
  const [primaryPalette] = rankedPalettes
  if (!primaryScene || !primaryPalette) return null

  const queries = buildQueries(rankedScenes, rankedPalettes, classification, taste)
  const [query] = queries
  if (!query) return null

  return {
    lane: `${primaryPalette.label} · ${primaryScene.lane}`,
    query,
    queries,
    source: 'embedding'
  }
}

export function clearEmbeddingSoundtrackCache(): void {
  sceneAnchorCache.clear()
  paletteAnchorCache.clear()
}
