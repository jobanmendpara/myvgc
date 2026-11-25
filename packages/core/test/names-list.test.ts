import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  NAME_KINDS,
  TYPES,
  champions,
  championsNames,
  nameBuild,
  nameBuildFrom,
  searchAbilities,
  searchNames,
  typeName,
} from '../src'

// About 30 KB gzipped with types, power and accuracy (DEV-222); it was about 23 KB without.
const LIMIT = 32_000

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

  it('stays small enough to keep on a phone, about 30 KB gzipped', () => {
    expect(gzipSync(JSON.stringify(names)).length).toBeLessThan(LIMIT)
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
      'baseStats',
      'items',
      'moveTypes',
      'moves',
      'powerAndAccuracy',
      'species',
      'typesBySpecies',
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

describe('types, power and accuracy in the names list', () => {
  const names = championsNames()

  it("gives a species its types, and a Mega form the Mega's own", () => {
    expect(names.typesBySpecies.garchomp).toEqual(['dragon', 'ground'])
    expect(names.typesBySpecies.charizard).toEqual(['fire', 'flying'])
    expect(names.typesBySpecies.charizardmegax).toEqual(['fire', 'dragon'])
    expect(names.typesBySpecies.incineroar).toEqual(['fire', 'dark'])
  })

  it('gives every species and form one or two of the 18 types', () => {
    expect(Object.keys(names.typesBySpecies).sort()).toEqual(Object.keys(names.species).sort())
    for (const types of Object.values(names.typesBySpecies)) {
      expect(types.length === 1 || types.length === 2).toBe(true)
      for (const id of types) expect(typeName(id)).toBeDefined()
    }
  })

  it('gives each move its own type, not one an ability changes it to', () => {
    expect(names.moveTypes.hypervoice).toBe('normal')
    expect(names.moveTypes.moonblast).toBe('fairy')
    expect(names.moveTypes.protect).toBe('normal')
    expect(Object.keys(names.moveTypes).sort()).toEqual(Object.keys(names.moves).sort())
  })

  it('gives a damaging move its power and accuracy, and a status move neither', () => {
    expect(names.powerAndAccuracy.moonblast).toEqual({ power: 95, accuracy: 100 })
    expect(names.powerAndAccuracy.protect).toBeUndefined()
    expect(names.powerAndAccuracy.willowisp).toBeUndefined()
  })

  it('leaves out power that varies and accuracy for a move that never misses', () => {
    expect(names.powerAndAccuracy.lowkick).toEqual({ power: null, accuracy: 100 })
    expect(names.powerAndAccuracy.kowtowcleave).toEqual({ power: 85, accuracy: null })
  })
})

describe('TYPES', () => {
  it('holds the 18 types, without Stellar, under lower-case Showdown IDs', () => {
    expect(TYPES).toHaveLength(18)
    expect(typeName('fire')).toBe('Fire')
    expect(typeName('stellar')).toBeUndefined()
    for (const { id, name } of TYPES) expect(id).toBe(name.toLowerCase())
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

describe('nameBuildFrom', () => {
  const names = championsNames()
  const build = {
    species: 'incineroar',
    nickname: 'Roar',
    item: 'sitrusberry',
    ability: 'intimidate',
    nature: 'careful',
    moves: ['fakeout', 'flareblitz'],
    statPoints: { hp: 32, atk: 0, def: 0, spa: 0, spd: 32, spe: 2 },
  }

  it('names a build from the names list as the API names it from the data', () => {
    expect(nameBuildFrom(build, names)).toEqual(nameBuild(build))
  })

  it('shows the ID for a name the list does not have, or with no list at all', () => {
    const unknown = { ...build, species: 'missingno', moves: ['notamove'] }
    expect(nameBuildFrom(unknown, names).names).toMatchObject({
      species: 'missingno',
      moves: ['notamove'],
    })
    expect(nameBuildFrom(build, undefined).names).toMatchObject({
      species: 'incineroar',
      nature: 'Careful',
    })
  })
})
