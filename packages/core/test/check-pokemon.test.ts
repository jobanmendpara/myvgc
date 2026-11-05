import { describe, expect, it } from 'vitest'
import { type PokemonBuild, championsNames, checkPokemon } from '../src'

const NO_POINTS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }

function build(overrides: Partial<PokemonBuild> = {}): PokemonBuild {
  return { species: 'incineroar', moves: [], statPoints: NO_POINTS, ...overrides }
}

describe('checkPokemon', () => {
  it('accepts a full build and a build with only a species', () => {
    expect(
      checkPokemon([
        build(),
        build({
          species: 'floetteeternal',
          item: 'floettite',
          ability: 'flowerveil',
          nature: 'timid',
          moves: ['moonblast', 'lightofruin', 'protect'],
        }),
      ]),
    ).toEqual([])
  })

  it('reports each name the Champions data does not recognize, by path', () => {
    expect(
      checkPokemon([
        build(),
        build({
          species: 'notapokemon',
          item: 'notanitem',
          ability: 'notanability',
          nature: 'notanature',
          moves: ['protect', 'notamove'],
        }),
      ]),
    ).toEqual([
      {
        path: ['pokemon', 1, 'species'],
        message: '"notapokemon" is not a Pokémon in Pokémon Champions.',
      },
      {
        path: ['pokemon', 1, 'item'],
        message: '"notanitem" is not an item in Pokémon Champions.',
      },
      {
        path: ['pokemon', 1, 'ability'],
        message: '"notanability" is not an ability in Pokémon Champions.',
      },
      {
        path: ['pokemon', 1, 'nature'],
        message: '"notanature" is not a nature in Pokémon Champions.',
      },
      {
        path: ['pokemon', 1, 'moves', 1],
        message: '"notamove" is not a move in Pokémon Champions.',
      },
    ])
  })

  it('rejects an alias, since only the Showdown ID itself may be stored', () => {
    expect(checkPokemon([build({ species: 'rotomw' })])).toMatchObject([
      { path: ['pokemon', 0, 'species'] },
    ])
  })

  it('accepts every ID in the names list, which is what the pickers offer', () => {
    const names = championsNames()
    const moves = Object.keys(names.moves)
    const builds = [
      ...Object.keys(names.species).map((species) => build({ species })),
      ...Object.keys(names.items).map((item) => build({ item })),
      ...Object.keys(names.abilities).map((ability) => build({ ability })),
      ...moves.map((move) => build({ moves: [move] })),
    ]
    expect(checkPokemon(builds)).toEqual([])
  })
})
