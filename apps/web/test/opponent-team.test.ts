import type { NamedPokemonBuild } from '@myvgc/core/schema'
import { describe, expect, it } from 'vitest'
import {
  lostWithLastRound,
  readToOpponentTeam,
  toOpponentTeamInput,
} from '../app/lib/opponent-team'

const NO_POINTS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
const named = (species: string, more: Partial<NamedPokemonBuild> = {}): NamedPokemonBuild => ({
  species,
  moves: [],
  statPoints: NO_POINTS,
  names: { species, moves: [] },
  ...more,
})

describe('readToOpponentTeam', () => {
  it('gives each Pokémon read its own flags, and says what was left out', () => {
    const read = readToOpponentTeam({
      name: 'Their Team',
      replicaTeamId: '',
      pokemon: [
        named(''),
        named('incineroar', { ability: 'intimidate', moves: ['fakeout'] }),
        named('rillaboom'),
      ],
      flags: [
        { path: ['pokemon', 0, 'species'], message: 'Couldn’t read "Amoongus".' },
        { path: ['pokemon', 1, 'item'], message: 'Couldn’t read "Sitrus Bery".' },
        { path: ['pokemon', 2, 'statPoints'], message: 'Check the Stat Points.' },
      ],
    })

    expect(read.leftOut).toEqual(['Couldn’t read "Amoongus".'])
    expect(read.pokemon).toEqual([
      {
        species: 'incineroar',
        ability: 'intimidate',
        item: null,
        moves: ['fakeout', null, null, null],
        readFlags: ['Couldn’t read "Sitrus Bery".'],
      },
      {
        species: 'rillaboom',
        ability: null,
        item: null,
        moves: [null, null, null, null],
        readFlags: [],
      },
    ])
  })

  it('sends only what an open teamsheet shows, never the flags', () => {
    const { pokemon } = readToOpponentTeam({
      name: '',
      replicaTeamId: '',
      pokemon: [named('incineroar', { moves: ['fakeout'] })],
      flags: [{ path: ['pokemon', 0, 'moves', 1], message: 'Couldn’t read "Knock Of".' }],
    })

    expect(toOpponentTeamInput(pokemon)).toEqual([{ species: 'incineroar', moves: ['fakeout'] }])
  })
})

describe('lostWithLastRound', () => {
  const tournament = {
    rounds: [
      { id: 'r1', opponent: { id: 'wolfe' } },
      { id: 'r2', opponent: { id: 'aaron' } },
    ],
    opponentTeams: [{ opponentId: 'wolfe', pokemon: [] }],
    opponentAgeDivisions: [
      { opponentId: 'wolfe', ageDivision: 'Junior' as const },
      { opponentId: 'aaron', ageDivision: 'Masters' as const },
    ],
  }

  it('names what is recorded about them there', () => {
    expect(lostWithLastRound(tournament, 'r1', 'wolfe')).toBe('Team and Age Division')
    expect(lostWithLastRound(tournament, 'r2', 'aaron')).toBe('Age Division')
  })

  it('is nothing while another Round is against them', () => {
    expect(lostWithLastRound(tournament, 'r9', 'wolfe')).toBeUndefined()
  })
})
