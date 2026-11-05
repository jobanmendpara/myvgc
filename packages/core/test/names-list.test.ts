import { describe, expect, it } from 'vitest'
import { NAME_KINDS, champions, championsNames, searchNames } from '../src'

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

  it('leaves out Natures, which the web app carries itself', () => {
    expect(Object.keys(names).sort()).toEqual(['abilities', 'items', 'moves', 'species'])
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
