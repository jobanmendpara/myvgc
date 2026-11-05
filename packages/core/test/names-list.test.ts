import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { NAME_KINDS, champions, championsNames, searchAbilities, searchNames } from '../src'

describe('championsNames', () => {
  const names = championsNames()

  it('lists every Champions species, move, item and ability by Showdown ID', () => {
    expect(names.species.floetteeternal).toBe('Floette-Eternal')
    expect(names.species.rotomwash).toBe('Rotom-Wash')
    expect(names.moves.moonblast).toBe('Moonblast')
    expect(names.items.floettite).toBe('Floettite')
    expect(names.abilities.flowerveil).toBe('Flower Veil')
  })

  it('holds the counts measured for the pinned Champions data', () => {
    expect(Object.keys(names.species)).toHaveLength(392)
    expect(Object.keys(names.moves)).toHaveLength(515)
    expect(Object.keys(names.items)).toHaveLength(166)
    expect(Object.keys(names.abilities)).toHaveLength(317)
  })

  it('stays small enough to keep on a phone, about 17 KB gzipped', () => {
    expect(gzipSync(JSON.stringify(names)).length).toBeLessThan(20_000)
  })

  it('holds only names the Champions look-ups recognise, under their own IDs', () => {
    const lookUp = {
      species: 'species',
      moves: 'move',
      items: 'item',
      abilities: 'ability',
    } as const
    for (const kind of NAME_KINDS) {
      for (const [id, name] of Object.entries(names[kind])) {
        expect(champions[lookUp[kind]](id)).toEqual({ id, name })
      }
    }
  })

  it('leaves out Stat Alignments', () => {
    expect(Object.keys(names).sort()).toEqual([
      'abilities',
      'abilitiesBySpecies',
      'items',
      'moves',
      'species',
    ])
  })

  it('maps each species and form to its own abilities, by Showdown ID', () => {
    expect(names.abilitiesBySpecies.incineroar).toEqual(['blaze', 'intimidate'])
    expect(names.abilitiesBySpecies.rotomwash).toEqual(['levitate'])
    expect(names.abilitiesBySpecies.floetteeternal).toEqual(['flowerveil', 'symbiosis'])
  })

  it('gives every species at least one ability, all of them in the names list', () => {
    expect(Object.keys(names.abilitiesBySpecies).sort()).toEqual(Object.keys(names.species).sort())
    for (const abilities of Object.values(names.abilitiesBySpecies)) {
      expect(abilities.length).toBeGreaterThan(0)
      for (const id of abilities) expect(names.abilities[id]).toBeDefined()
    }
  })
})

describe('searchNames', () => {
  const species = {
    rotom: 'Rotom',
    rotomwash: 'Rotom-Wash',
    rotomheat: 'Rotom-Heat',
    incineroar: 'Incineroar',
    floetteeternal: 'Floette-Eternal',
  }

  it('lists everything in name order for an empty query', () => {
    expect(searchNames(species, '  ').map((entry) => entry.name)).toEqual([
      'Floette-Eternal',
      'Incineroar',
      'Rotom',
      'Rotom-Heat',
      'Rotom-Wash',
    ])
  })

  it('ignores case and punctuation, like Showdown', () => {
    expect(searchNames(species, 'rotom wash')).toEqual([{ id: 'rotomwash', name: 'Rotom-Wash' }])
    expect(searchNames(species, 'ROTOM-W')).toEqual([{ id: 'rotomwash', name: 'Rotom-Wash' }])
  })

  it('puts names that start with the query before names that only contain it', () => {
    expect(searchNames(species, 'eter').map((entry) => entry.id)).toEqual(['floetteeternal'])
    const table = { drainpunch: 'Drain Punch', punchingglove: 'Punching Glove' }
    expect(searchNames(table, 'punch').map((entry) => entry.id)).toEqual([
      'punchingglove',
      'drainpunch',
    ])
  })

  it('stops at the limit', () => {
    expect(searchNames(species, 'rotom', 2).map((entry) => entry.id)).toEqual([
      'rotom',
      'rotomheat',
    ])
  })

  it('finds nothing when no name matches', () => {
    expect(searchNames(species, 'zzz')).toEqual([])
  })
})

describe('searchAbilities', () => {
  const names = {
    abilities: {
      adaptability: 'Adaptability',
      blaze: 'Blaze',
      intimidate: 'Intimidate',
      levitate: 'Levitate',
      moxie: 'Moxie',
    },
    abilitiesBySpecies: {
      incineroar: ['intimidate', 'blaze'],
      gyarados: ['moxie', 'intimidate'],
      oldform: ['blaze', 'removedability'],
    },
  }
  const ids = (found: { id: string }[]) => found.map((entry) => entry.id)

  it("lists only the species' own abilities, in name order, for an empty query", () => {
    expect(searchAbilities(names, 'incineroar', '')).toEqual([
      { id: 'blaze', name: 'Blaze' },
      { id: 'intimidate', name: 'Intimidate' },
    ])
    expect(ids(searchAbilities(names, 'incineroar', '  '))).toEqual(['blaze', 'intimidate'])
  })

  it("puts the species' own abilities before other matches when searching", () => {
    expect(ids(searchAbilities(names, 'gyarados', 'a'))).toEqual([
      'intimidate',
      'adaptability',
      'blaze',
      'levitate',
    ])
  })

  it("still finds abilities that aren't the species' own, since nothing is rejected", () => {
    expect(ids(searchAbilities(names, 'incineroar', 'levi'))).toEqual(['levitate'])
  })

  it('lists no ability twice', () => {
    expect(ids(searchAbilities(names, 'incineroar', 'blaze'))).toEqual(['blaze'])
  })

  it('searches every ability when no species is chosen, or the species has none listed', () => {
    const all = ['adaptability', 'blaze', 'intimidate', 'levitate', 'moxie']
    expect(ids(searchAbilities(names, null, ''))).toEqual(all)
    expect(ids(searchAbilities(names, 'unknownspecies', ''))).toEqual(all)
  })

  it('leaves out abilities the names list no longer has', () => {
    expect(ids(searchAbilities(names, 'oldform', ''))).toEqual(['blaze'])
  })

  it('stops at the limit, keeping own abilities first', () => {
    expect(ids(searchAbilities(names, 'gyarados', 'a', 2))).toEqual(['intimidate', 'adaptability'])
    expect(ids(searchAbilities(names, 'incineroar', '', 1))).toEqual(['blaze'])
  })
})
