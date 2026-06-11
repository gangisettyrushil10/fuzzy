// Pure, dependency-free helpers for AI roster refinement (so they unit-test in
// the node env, like entityExtractorMock). The LLM call lives in entityRefine.ts;
// here we just build its prompt and parse its reply into a keep-set.

import type { ExtractedEntity } from '@shared/types/database'

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function buildRefinePrompt(entities: ExtractedEntity[]): { system: string; user: string } {
  const system = [
    'You are cleaning a list of candidate names auto-extracted from a book.',
    'KEEP only entries that name an actual person or character — real or fictional — whether referred to by first name, surname, full name, or nickname.',
    'REMOVE anything that is not a person: places, schools, houses/teams, organizations, spells, potions, objects, creatures or species, titles of books/songs, holidays, events, days, months, and generic capitalized words.',
    'Respond with ONLY a JSON object of the form {"characters": ["Name", ...]}, listing the kept names exactly as given. No explanation.'
  ].join(' ')
  const list = entities
    .map((e, i) => {
      const aliases = e.aliases.length ? ` (aka ${e.aliases.slice(0, 4).join(', ')})` : ''
      return `${i + 1}. ${e.name}${aliases} — ${e.mentionCount} mentions`
    })
    .join('\n')
  const user = `Candidate names:\n${list}\n\nReturn the JSON object listing which are people/characters.`
  return { system, user }
}

// Parse the model reply into a set of normalized names to keep. Tolerant of code
// fences / prose around the JSON, and of bare-array or {characters|people|names}
// shapes. Returns an empty set when nothing parses (caller then keeps the local
// roster rather than wiping it).
export function parseKeptNames(text: string): Set<string> {
  const out = new Set<string>()
  const add = (arr: unknown): void => {
    if (Array.isArray(arr)) for (const v of arr) if (typeof v === 'string') out.add(normalizeName(v))
  }
  const block = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
  if (!block) return out
  try {
    const parsed = JSON.parse(block[0]) as unknown
    if (Array.isArray(parsed)) add(parsed)
    else if (parsed && typeof parsed === 'object') {
      const o = parsed as Record<string, unknown>
      add(o.characters ?? o.people ?? o.names ?? o.keep)
    }
  } catch {
    /* unparseable → empty set → caller keeps local roster */
  }
  return out
}

// Apply the keep-set to the roster: an entity survives if its canonical name OR
// any alias was kept. If the model kept nothing recognizable, keep the original
// (a refine should never silently empty the cast).
export function applyKeptNames(entities: ExtractedEntity[], kept: Set<string>): ExtractedEntity[] {
  if (kept.size === 0) return entities
  const filtered = entities.filter(
    (e) => kept.has(e.normalizedName) || e.aliases.some((a) => kept.has(normalizeName(a)))
  )
  return filtered.length > 0 ? filtered : entities
}
