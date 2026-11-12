import { describe, expect, it } from 'vitest'
import {
  type PokemonBuild,
  type RoundFacts,
  clearOpponentSide,
  latestOpponentTeam,
  losesOpponentTeam,
  mergeOpponentTeams,
  opponentTeamFromRead,
  roundInputSchema,
  roundIssues,
} from '../src/schema'

const NO_POINTS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
const mon = (species: string, more: Partial<PokemonBuild> = {}): PokemonBuild => ({
  species,
  moves: [],
  statPoints: NO_POINTS,
  ...more,
})

const issuePaths = (input: object) => {
  const read = roundInputSchema.safeParse(input)
  return read.success ? [] : read.error.issues.map((issue) => issue.path.join('.'))
}

describe('an Opponent’s Team on the Round input', () => {
  it('takes species alone, as an open teamsheet is often filled in later', () => {
    const read = roundInputSchema.parse({
      opponentTeam: [{ species: 'incineroar' }, { species: 'rillaboom', item: 'assaultvest' }],
    })
    expect(read.opponentTeam).toEqual([
      {
        species: 'incineroar',
        moves: [],
        statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      },
      {
        species: 'rillaboom',
        item: 'assaultvest',
        moves: [],
        statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      },
    ])
  })

  it('is left out unless sent, so a save without it changes nothing', () => {
    expect(roundInputSchema.parse({}).opponentTeam).toBeUndefined()
  })

  it('can be an empty list, which deletes it', () => {
    expect(roundInputSchema.parse({ opponentTeam: [] }).opponentTeam).toEqual([])
  })

  it('has at most six Pokémon', () => {
    const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((species) => ({ species }))
    expect(issuePaths({ opponentTeam: seven })).toEqual(['opponentTeam'])
  })

  it('lists each species once, though two forms of one species are different', () => {
    expect(
      issuePaths({
        opponentTeam: [
          { species: 'rotomwash' },
          { species: 'rotomheat' },
          { species: 'rotomwash' },
        ],
      }),
    ).toEqual(['opponentTeam.2.species'])
  })

  it('checks moves as a Pokémon build does', () => {
    expect(
      issuePaths({
        opponentTeam: [{ species: 'incineroar', moves: ['fakeout', 'fakeout'] }],
      }),
    ).toEqual(['opponentTeam.0.moves.1'])
  })
})

describe('roundIssues for an Opponent’s Team', () => {
  const round: RoundFacts = {
    phase: 'swiss',
    roundNumber: 1,
    stage: null,
    bestOf: 3,
    bye: false,
    result: 'win',
    gameScore: null,
    hasOpponent: true,
    games: [],
    hasOpponentTeam: true,
  }
  const fields = (facts: RoundFacts) => roundIssues(facts).map((issue) => issue.path.join('.'))

  it('accepts one on a Round with an Opponent', () => {
    expect(fields(round)).toEqual([])
  })

  it('refuses one on a Bye or a Round with no Opponent', () => {
    expect(fields({ ...round, bye: true, hasOpponent: false, result: null })).toEqual([
      'opponentTeam',
    ])
    expect(fields({ ...round, hasOpponent: false })).toEqual(['opponent', 'opponentTeam'])
  })
})

describe('mergeOpponentTeams', () => {
  it('keeps the survivor’s Pokémon first and adds the duplicate’s species it lacks', () => {
    const merged = mergeOpponentTeams(
      [mon('incineroar'), mon('rillaboom')],
      [mon('rillaboom'), mon('urshifu'), mon('amoonguss')],
    )
    expect(merged.map((build) => build.species)).toEqual([
      'incineroar',
      'rillaboom',
      'urshifu',
      'amoonguss',
    ])
  })

  it('stops at six, keeping the survivor’s species', () => {
    const merged = mergeOpponentTeams(
      ['a', 'b', 'c', 'd', 'e'].map((species) => mon(species)),
      ['f', 'g', 'a'].map((species) => mon(species)),
    )
    expect(merged.map((build) => build.species)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('fills the survivor’s empty ability, held item and moves from the duplicate', () => {
    const merged = mergeOpponentTeams(
      [mon('incineroar', { item: 'sitrusberry' }), mon('rillaboom', { moves: ['fakeout'] })],
      [
        mon('incineroar', { item: 'safetygoggles', ability: 'intimidate', moves: ['fakeout'] }),
        mon('rillaboom', { ability: 'grassysurge', moves: ['woodhammer', 'grassyglide'] }),
      ],
    )
    expect(merged).toEqual([
      mon('incineroar', { item: 'sitrusberry', ability: 'intimidate', moves: ['fakeout'] }),
      mon('rillaboom', { ability: 'grassysurge', moves: ['fakeout'] }),
    ])
  })
})

describe('latestOpponentTeam', () => {
  const wolfe = 'wolfe'
  const tournament = (
    id: string,
    startDate: string,
    regulation: 'M-B' | 'M-C',
    species: string[] = ['incineroar'],
  ) => ({
    id,
    startDate,
    regulation,
    opponentTeams: [{ opponentId: wolfe, pokemon: species.map((s) => mon(s)) }],
  })

  it('is their Opponent’s Team from the latest other Tournament in the same Regulation', () => {
    const found = latestOpponentTeam(
      [
        tournament('older', '2026-05-01', 'M-C', ['rillaboom']),
        tournament('other-regulation', '2026-09-01', 'M-B', ['urshifu']),
        tournament('latest', '2026-08-01', 'M-C', ['amoonguss']),
        tournament('this-one', '2026-10-01', 'M-C', ['kingambit']),
      ],
      { opponentId: wolfe, regulation: 'M-C', tournamentId: 'this-one' },
    )
    expect(found?.tournament.id).toBe('latest')
    expect(found?.pokemon.map((build) => build.species)).toEqual(['amoonguss'])
  })

  it('is nothing when they have none in that Regulation', () => {
    expect(
      latestOpponentTeam([tournament('a', '2026-05-01', 'M-B')], {
        opponentId: wolfe,
        regulation: 'M-C',
        tournamentId: 'b',
      }),
    ).toBeUndefined()
    expect(
      latestOpponentTeam([tournament('a', '2026-05-01', 'M-C')], {
        opponentId: 'someone-else',
        regulation: 'M-C',
        tournamentId: 'b',
      }),
    ).toBeUndefined()
  })
})

describe('losesOpponentTeam', () => {
  const tournament = {
    rounds: [
      { id: 'r1', opponent: { id: 'wolfe' } },
      { id: 'r2', opponent: { id: 'wolfe' } },
      { id: 'r3', opponent: { id: 'aaron' } },
    ],
    opponentTeams: [
      { opponentId: 'wolfe', pokemon: [mon('incineroar')] },
      { opponentId: 'aaron', pokemon: [mon('rillaboom')] },
    ],
  }

  it('is true when no other Round in the Tournament is against them', () => {
    expect(losesOpponentTeam(tournament, 'r3', 'aaron')).toBe(true)
  })

  it('is false while another Round is against them, or when they have no Team there', () => {
    expect(losesOpponentTeam(tournament, 'r1', 'wolfe')).toBe(false)
    expect(losesOpponentTeam({ ...tournament, opponentTeams: [] }, 'r3', 'aaron')).toBe(false)
    expect(losesOpponentTeam(tournament, 'r3', undefined)).toBe(false)
  })
})

describe('clearOpponentSide', () => {
  const game = (opponentBrought: string[], opponentLeads: string[] = []) => ({
    number: 1 as const,
    brought: ['rillaboom'],
    leads: [],
    opponentBrought,
    opponentLeads,
    result: null,
    notes: '',
  })

  it('clears the Opponent’s side of a Game as it was saved against the old Opponent', () => {
    const saved = [game(['incineroar', 'kingambit'], ['incineroar'])]
    expect(clearOpponentSide(saved, saved)).toEqual([game([])])
  })

  it('keeps picks sent for the new Opponent, and Games that weren’t saved', () => {
    const saved = [game(['incineroar'])]
    expect(clearOpponentSide([game(['kingambit'])], saved)).toEqual([game(['kingambit'])])
    expect(clearOpponentSide([game(['kingambit'])], [])).toEqual([game(['kingambit'])])
  })
})

describe('opponentTeamFromRead', () => {
  it('keeps only what an open teamsheet shows: species, ability, held item and moves', () => {
    const read = opponentTeamFromRead({
      pokemon: [
        mon('kingambit', {
          nature: 'adamant',
          ability: 'defiant',
          item: 'chopleberry',
          moves: ['kowtowcleave', 'suckerpunch'],
          statPoints: { hp: 32, atk: 32, def: 0, spa: 0, spd: 0, spe: 2 },
        }),
      ],
      flags: [],
    })

    expect(read).toEqual({
      pokemon: [
        mon('kingambit', {
          ability: 'defiant',
          item: 'chopleberry',
          moves: ['kowtowcleave', 'suckerpunch'],
        }),
      ],
      flags: [],
      leftOut: [],
    })
  })

  it('drops flags about Stat Points and Stat Alignment, which aren’t kept', () => {
    const read = opponentTeamFromRead({
      pokemon: [mon('kingambit')],
      flags: [
        { path: ['pokemon', 0, 'nature'], message: 'Couldn’t read "Adamnt".' },
        { path: ['pokemon', 0, 'statPoints', 'spe'], message: 'No Stat Points give 999.' },
        { path: ['pokemon', 0, 'item'], message: 'Couldn’t read "Chople Bery".' },
      ],
    })

    expect(read.flags).toEqual([
      { path: ['pokemon', 0, 'item'], message: 'Couldn’t read "Chople Bery".' },
    ])
  })

  it('leaves out a Pokémon whose species wasn’t read, says why, and moves later flags up', () => {
    const read = opponentTeamFromRead({
      pokemon: [mon('incineroar'), mon(''), mon('rillaboom')],
      flags: [
        { path: ['pokemon', 1, 'species'], message: 'Couldn’t read "Amoongus".' },
        { path: ['pokemon', 1, 'item'], message: 'Couldn’t read "Sitrus Bery".' },
        { path: ['pokemon', 2, 'moves', 1], message: 'Couldn’t read "Fake Out".' },
      ],
    })

    expect(read.pokemon.map((build) => build.species)).toEqual(['incineroar', 'rillaboom'])
    expect(read.flags).toEqual([
      { path: ['pokemon', 1, 'moves', 1], message: 'Couldn’t read "Fake Out".' },
    ])
    expect(read.leftOut).toEqual(['Couldn’t read "Amoongus".'])
  })

  it('reads a species listed twice once, as their Team lists each species once', () => {
    const read = opponentTeamFromRead({
      pokemon: [mon('garchomp', { item: 'lifeorb' }), mon('garchomp', { item: 'choicescarf' })],
      flags: [{ path: ['pokemon', 1, 'moves', 0], message: 'Couldn’t read "Earthqake".' }],
    })

    expect(read.pokemon).toEqual([mon('garchomp', { item: 'lifeorb' })])
    expect(read.flags).toEqual([])
    expect(read.leftOut).toEqual(['A species listed twice was read once.'])
  })
})
