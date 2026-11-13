import { describe, expect, it } from 'vitest'
import {
  type Game,
  type StatisticsRound,
  type StatisticsTournament,
  describeCoverage,
  statistics,
} from '../src/schema'

const wolfe = { id: 'o1', displayName: 'Wolfe' }
const aaron = { id: 'o2', displayName: 'Aaron' }
let ids = 0
const tournament = (
  rounds: StatisticsRound[],
  opponentTeams: StatisticsTournament['opponentTeams'] = [],
): StatisticsTournament => ({ id: `t${++ids}`, name: 'Regional', rounds, opponentTeams })
const teamOf = (opponent: { id: string }, ...species: string[]) => ({
  opponentId: opponent.id,
  pokemon: species.map((s) => ({ species: s })),
})
const round = (
  result: StatisticsRound['result'],
  overrides: Partial<StatisticsRound> = {},
): StatisticsRound => ({
  id: `r${++ids}`,
  phase: 'swiss',
  roundNumber: 1,
  stage: null,
  bye: false,
  result,
  gameScore: null,
  opponent: wolfe,
  games: [],
  ...overrides,
})
const bye = () => round('win', { bye: true, opponent: null })
const game = (
  number: Game['number'],
  result: Game['result'],
  brought: string[],
  leads: string[] = brought.slice(0, 2),
): Game => ({
  number,
  brought,
  leads,
  opponentBrought: [],
  opponentLeads: [],
  result,
  notes: '',
})

describe('statistics: species faced', () => {
  it('counts each Round against an Opponent’s Team once per species, leaving Byes out', () => {
    const stats = statistics([
      tournament(
        [round('win'), round('tie', { opponent: aaron }), bye()],
        [teamOf(wolfe, 'incineroar', 'rillaboom'), teamOf(aaron, 'incineroar')],
      ),
      tournament([round('loss')], [teamOf(wolfe, 'incineroar')]),
    ])
    expect(stats.speciesFaced.rows).toMatchObject([
      { species: 'incineroar', played: 3, wins: 1, losses: 1, ties: 1, winRate: 1 / 3 },
      { species: 'rillaboom', played: 1, wins: 1, losses: 0, ties: 0, winRate: 1 },
    ])
  })

  it('says how many Rounds it is based on, and how many have no Opponent’s Team', () => {
    const stats = statistics([
      tournament(
        [round('win'), round('loss', { opponent: aaron }), round('win', { opponent: null }), bye()],
        [teamOf(wolfe, 'incineroar')],
      ),
    ])
    expect(stats.speciesFaced.coverage).toEqual({ counted: 1, of: 3, noOpponentTeam: 2 })
  })
})

describe('statistics: Brought Pokémon', () => {
  it('counts each Game a species was Brought in, by that Game’s result', () => {
    const stats = statistics([
      tournament([
        round('win', {
          games: [
            game(1, 'loss', ['incineroar', 'amoonguss', 'kingambit', 'rillaboom']),
            game(2, 'win', ['incineroar', 'amoonguss', 'garchomp', 'rillaboom']),
            game(3, 'win', ['incineroar', 'kingambit', 'garchomp', 'rillaboom']),
          ],
        }),
      ]),
    ])
    expect(stats.brought.rows).toMatchObject([
      { species: 'incineroar', played: 3, wins: 2, losses: 1, ties: 0, winRate: 2 / 3 },
      { species: 'rillaboom', played: 3, wins: 2, losses: 1, ties: 0, winRate: 2 / 3 },
      { species: 'amoonguss', played: 2, wins: 1, losses: 1, ties: 0, winRate: 0.5 },
      { species: 'garchomp', played: 2, wins: 2, losses: 0, ties: 0, winRate: 1 },
      { species: 'kingambit', played: 2, wins: 1, losses: 1, ties: 0, winRate: 0.5 },
    ])
  })

  it('leaves out Games with no Game result or no Brought Pokémon, and says so', () => {
    const stats = statistics([
      tournament([
        round('win', {
          games: [
            game(1, 'win', ['incineroar']),
            game(2, null, ['incineroar']),
            game(3, 'win', []),
          ],
        }),
        round('win', { games: [game(1, 'loss', [])] }),
        bye(),
      ]),
    ])
    expect(stats.brought.rows).toMatchObject([
      { species: 'incineroar', played: 1, wins: 1, losses: 0, ties: 0, winRate: 1 },
    ])
    expect(stats.brought.coverage).toEqual({ counted: 1, of: 4, noResult: 1, noBrought: 2 })
  })
})

describe('statistics: Leads', () => {
  const bring = ['incineroar', 'amoonguss', 'kingambit', 'rillaboom']

  it('counts a Lead pair the same whichever order its Leads were recorded in', () => {
    const stats = statistics([
      tournament([
        round('win', {
          games: [
            game(1, 'win', bring, ['incineroar', 'amoonguss']),
            game(2, 'loss', bring, ['amoonguss', 'incineroar']),
            game(3, 'win', bring, ['kingambit', 'rillaboom']),
          ],
        }),
      ]),
    ])
    expect(stats.leadPairs.rows).toMatchObject([
      {
        species: ['amoonguss', 'incineroar'],
        played: 2,
        wins: 1,
        losses: 1,
        ties: 0,
        winRate: 0.5,
      },
      { species: ['kingambit', 'rillaboom'], played: 1, wins: 1, losses: 0, ties: 0, winRate: 1 },
    ])
  })

  it('counts single Leads in Games with one or two Leads; pairs only in Games with two', () => {
    const stats = statistics([
      tournament([
        round('win', {
          games: [
            game(1, 'win', bring, ['incineroar', 'amoonguss']),
            game(2, 'tie', bring, ['incineroar']),
            game(3, 'loss', bring, []),
          ],
        }),
        round('loss', { games: [game(1, null, bring, ['incineroar', 'amoonguss'])] }),
      ]),
    ])
    expect(stats.leads.rows).toMatchObject([
      { species: 'incineroar', played: 2, wins: 1, losses: 0, ties: 1, winRate: 0.5 },
      { species: 'amoonguss', played: 1, wins: 1, losses: 0, ties: 0, winRate: 1 },
    ])
    expect(stats.leads.coverage).toEqual({ counted: 2, of: 4, noResult: 1, noLeads: 1 })
    expect(stats.leadPairs.rows.map((row) => row.played)).toEqual([1])
    expect(stats.leadPairs.coverage).toEqual({
      counted: 1,
      of: 4,
      noResult: 1,
      noLeads: 1,
      oneLead: 1,
    })
  })
})

describe('statistics: the Opponent’s side of Games', () => {
  const mine = ['incineroar', 'sinistcha', 'kingambit', 'rillaboom']
  const theirs = (
    number: Game['number'],
    result: Game['result'],
    opponentBrought: string[],
    opponentLeads: string[] = opponentBrought.slice(0, 2),
  ): Game => ({ ...game(number, result, mine), opponentBrought, opponentLeads })

  it('counts each Game an Opponent Brought a species in, by the User’s Game result', () => {
    const stats = statistics([
      tournament([
        round('win', {
          games: [
            theirs(1, 'loss', ['garchomp', 'sneasler', 'kingambit', 'whimsicott']),
            theirs(2, 'win', ['garchomp', 'sneasler', 'basculegion', 'whimsicott']),
            theirs(3, 'tie', ['garchomp', 'kingambit']),
          ],
        }),
      ]),
    ])
    expect(stats.opponentBrought.rows.slice(0, 2)).toMatchObject([
      { species: 'garchomp', played: 3, wins: 1, losses: 1, ties: 1, winRate: 1 / 3 },
      { species: 'kingambit', played: 2, wins: 0, losses: 1, ties: 1, winRate: 0 },
    ])
    // The User's side is counted on its own.
    expect(stats.brought.rows.map((row) => row.played)).toEqual([3, 3, 3, 3])
  })

  it('counts the Opponent’s Lead pairs in either order, and their single Leads', () => {
    const bring = ['garchomp', 'sneasler', 'kingambit', 'whimsicott']
    const stats = statistics([
      tournament([
        round('win', {
          games: [
            theirs(1, 'win', bring, ['sneasler', 'garchomp']),
            theirs(2, 'loss', bring, ['garchomp', 'sneasler']),
            theirs(3, 'win', bring, ['kingambit']),
          ],
        }),
      ]),
    ])
    expect(stats.opponentLeadPairs.rows).toMatchObject([
      { species: ['garchomp', 'sneasler'], played: 2, wins: 1, losses: 1, winRate: 0.5 },
    ])
    expect(stats.opponentLeadPairs.coverage).toEqual({
      counted: 2,
      of: 3,
      noResult: 0,
      noLeads: 0,
      oneLead: 1,
    })
    expect(stats.opponentLeads.rows).toMatchObject([
      { species: 'garchomp', played: 2, wins: 1, losses: 1 },
      { species: 'sneasler', played: 2, wins: 1, losses: 1 },
      { species: 'kingambit', played: 1, wins: 1, losses: 0 },
    ])
  })

  it('leaves out Byes, Games with no Game result and Games with no Brought Pokémon or Leads for the Opponent', () => {
    const stats = statistics([
      tournament([
        round('win', {
          games: [
            theirs(1, 'win', ['garchomp'], ['garchomp']),
            theirs(2, null, ['garchomp']),
            theirs(3, 'win', []),
          ],
        }),
        bye(),
      ]),
    ])
    expect(stats.opponentBrought.coverage).toEqual({
      counted: 1,
      of: 3,
      noResult: 1,
      noBrought: 1,
    })
    expect(stats.opponentLeads.coverage).toEqual({ counted: 1, of: 3, noResult: 1, noLeads: 1 })
  })
})

describe('statistics: how often a species on an Opponent’s Team was Brought', () => {
  const pick = (number: Game['number'], result: Game['result'], opponentBrought: string[]) => ({
    ...game(number, result, []),
    opponentBrought,
  })

  it('counts, per species on the Team, the Games it was Brought in out of the Games played', () => {
    const stats = statistics([
      tournament(
        [
          round('win', {
            games: [
              pick(1, 'win', ['garchomp', 'sneasler']),
              pick(2, 'loss', ['garchomp', 'kingambit']),
            ],
          }),
          round('loss', {
            opponent: aaron,
            games: [pick(1, 'loss', ['garchomp'])],
          }),
        ],
        [
          teamOf(wolfe, 'garchomp', 'sneasler', 'kingambit', 'whimsicott'),
          teamOf(aaron, 'garchomp', 'whimsicott'),
        ],
      ),
    ])
    expect(stats.bringRates.rows).toMatchObject([
      { species: 'garchomp', played: 3, brought: 3, bringRate: 1 },
      { species: 'whimsicott', played: 3, brought: 0, bringRate: 0 },
      { species: 'kingambit', played: 2, brought: 1, bringRate: 0.5 },
      { species: 'sneasler', played: 2, brought: 1, bringRate: 0.5 },
    ])
  })

  it('lists every Game a row counts, saying whether the species was Brought in it', () => {
    const stats = statistics([
      tournament(
        [
          round('win', {
            id: 'r1',
            games: [pick(1, 'win', ['garchomp']), pick(2, 'loss', ['sneasler'])],
          }),
        ],
        [teamOf(wolfe, 'garchomp', 'sneasler')],
      ),
    ])
    expect(stats.bringRates.rows.find((r) => r.species === 'garchomp')?.counted).toEqual([
      { round: 'r1', game: 1, brought: true },
      { round: 'r1', game: 2, brought: false },
    ])
  })

  it('leaves out Games with no Game result, no Opponent’s Team or no Brought Pokémon', () => {
    const stats = statistics([
      tournament(
        [
          round('win', {
            games: [pick(1, 'win', ['garchomp']), pick(2, null, ['garchomp']), pick(3, 'win', [])],
          }),
          round('win', { opponent: aaron, games: [pick(1, 'win', ['garchomp'])] }),
          bye(),
        ],
        [teamOf(wolfe, 'garchomp')],
      ),
    ])
    expect(stats.bringRates.coverage).toEqual({
      counted: 1,
      of: 4,
      noResult: 1,
      noOpponentTeam: 1,
      noBrought: 1,
    })
  })
})

describe('statistics: the Rounds and Games behind a row', () => {
  it('lists the Rounds a species faced row counts, and looks each Round up', () => {
    const won = round('win', { id: 'won', roundNumber: 1 })
    const lost = round('loss', {
      id: 'lost',
      phase: 'top-cut',
      roundNumber: null,
      stage: 'top-8',
      gameScore: { won: 1, lost: 2 },
      opponent: aaron,
      games: [game(1, 'win', []), game(2, 'loss', []), game(3, 'loss', [])],
    })
    const unknown = round('win', { id: 'unknown', opponent: null })
    const stats = statistics([
      {
        id: 'ny',
        name: 'New York Regional',
        rounds: [won, lost, unknown, round('win', { id: 'bye', bye: true, opponent: null })],
        opponentTeams: [teamOf(wolfe, 'incineroar', 'rillaboom'), teamOf(aaron, 'incineroar')],
      },
    ])

    const row = (species: string) => stats.speciesFaced.rows.find((r) => r.species === species)
    expect(row('incineroar')?.counted).toEqual([{ round: 'won' }, { round: 'lost' }])
    expect(row('rillaboom')?.counted).toEqual([{ round: 'won' }])
    expect(stats.rounds.lost).toEqual({
      id: 'lost',
      tournament: { id: 'ny', name: 'New York Regional' },
      phase: 'top-cut',
      roundNumber: null,
      stage: 'top-8',
      result: 'loss',
      gameScore: { won: 1, lost: 2 },
      opponent: aaron,
      games: [
        { number: 1, result: 'win' },
        { number: 2, result: 'loss' },
        { number: 3, result: 'loss' },
      ],
    })
    expect(stats.rounds.unknown).toBeDefined()
    expect(stats.rounds.bye).toBeUndefined()
  })

  it('lists the Games a Lead pair, Single Lead or Brought Pokémon row counts', () => {
    const bring = ['incineroar', 'amoonguss', 'kingambit', 'rillaboom']
    const stats = statistics([
      tournament([
        round('win', {
          id: 'r1',
          games: [
            game(1, 'win', bring, ['incineroar', 'amoonguss']),
            game(2, 'loss', bring, ['amoonguss', 'incineroar']),
            game(3, null, bring, ['incineroar', 'amoonguss']),
          ],
        }),
        round('loss', { id: 'r2', games: [game(1, 'loss', ['incineroar'], ['incineroar'])] }),
      ]),
    ])

    const games = [
      { round: 'r1', game: 1 },
      { round: 'r1', game: 2 },
    ]
    expect(stats.leadPairs.rows[0]?.counted).toEqual(games)
    expect(stats.leads.rows.find((r) => r.species === 'incineroar')?.counted).toEqual([
      ...games,
      { round: 'r2', game: 1 },
    ])
    expect(stats.brought.rows.find((r) => r.species === 'kingambit')?.counted).toEqual(games)
    expect(Object.keys(stats.rounds)).toEqual(['r1', 'r2'])
  })
})

describe('describeCoverage', () => {
  it('says what a table is based on and why the rest were left out', () => {
    expect(describeCoverage({ counted: 34, of: 41, noOpponentTeam: 7 }, 'Rounds')).toBe(
      'Based on 34 of 41 Rounds, 7 have no Opponent’s Team',
    )
    expect(
      describeCoverage({ counted: 5, of: 9, noResult: 1, noLeads: 0, oneLead: 3 }, 'Games'),
    ).toBe('Based on 5 of 9 Games, 1 has no Game result, 3 have only one Lead')
    expect(describeCoverage({ counted: 4, of: 4, noResult: 0, noBrought: 0 }, 'Games')).toBe(
      'Based on all 4 Games',
    )
    expect(describeCoverage({ counted: 1, of: 1, noOpponentTeam: 0 }, 'Rounds')).toBe(
      'Based on 1 Round',
    )
    expect(describeCoverage({ counted: 0, of: 1, noOpponentTeam: 1 }, 'Rounds')).toBe(
      'Based on 0 of 1 Round, 1 has no Opponent’s Team',
    )
    expect(describeCoverage({ counted: 0, of: 0, noOpponentTeam: 0 }, 'Rounds')).toBe(
      'No Rounds yet',
    )
  })
})
