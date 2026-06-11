import { describe, it, expect } from 'vitest'
import {
  buildRefinePrompt,
  parseKeptNames,
  applyKeptNames,
  normalizeName
} from '../src/main/services/entities/entityRefineCore'
import type { ExtractedEntity } from '../src/shared/types/database'

function ent(name: string, aliases: string[] = []): ExtractedEntity {
  return {
    name,
    normalizedName: normalizeName(name),
    aliases,
    mentionCount: 5,
    firstPage: 1,
    salience: 0.5,
    mentions: []
  }
}

describe('buildRefinePrompt', () => {
  it('lists every candidate with aliases and instructs JSON output', () => {
    const { system, user } = buildRefinePrompt([ent('Remus Lupin', ['Moony']), ent('Patronus')])
    expect(system).toContain('{"characters"')
    expect(user).toContain('Remus Lupin (aka Moony)')
    expect(user).toContain('Patronus')
  })
})

describe('parseKeptNames', () => {
  it('parses a clean characters object', () => {
    expect([...parseKeptNames('{"characters": ["Remus", "Sirius"]}')]).toEqual(['remus', 'sirius'])
  })

  it('tolerates code fences / prose around the JSON', () => {
    const reply = 'Sure!\n```json\n{"characters":["James Potter"]}\n```'
    expect([...parseKeptNames(reply)]).toEqual(['james potter'])
  })

  it('accepts a bare array and alternate keys', () => {
    expect([...parseKeptNames('["A","B"]')]).toEqual(['a', 'b'])
    expect([...parseKeptNames('{"people":["C"]}')]).toEqual(['c'])
  })

  it('returns an empty set when nothing parses', () => {
    expect(parseKeptNames('no json here').size).toBe(0)
  })
})

describe('applyKeptNames', () => {
  const roster = [ent('Remus Lupin', ['Moony']), ent('Patronus'), ent('Hogwarts')]

  it('keeps only people, matching by name or alias', () => {
    const kept = parseKeptNames('{"characters":["Moony"]}')
    expect(applyKeptNames(roster, kept).map((e) => e.name)).toEqual(['Remus Lupin'])
  })

  it('never empties the roster: an empty keep-set returns the original', () => {
    expect(applyKeptNames(roster, new Set())).toBe(roster)
  })

  it('falls back to the original if nothing matched (avoids wiping the cast)', () => {
    expect(applyKeptNames(roster, new Set(['nobody-here'])).length).toBe(roster.length)
  })
})
