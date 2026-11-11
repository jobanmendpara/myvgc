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
const tournament = (
  rounds: StatisticsRound[],
  opponentTeams: StatisticsTournament['opponentTeams'] = [],
): StatisticsTournament => ({ rounds, opponentTeams })
const teamOf = (opponent: { id: string }, ...species: string[]) => ({
  opponentId: opponent.id,
  pokemon: species.map((s) => ({ species: s })),
})
const round = (
  result: StatisticsRound['result'],
  overrides: Partial<StatisticsRound> = {},
): StatisticsRound => ({ bye: false, result, opponent: wolfe, games: [], ...overrides })
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
    expect(stats.speciesFaced.rows).toEqual([
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
    expect(stats.brought.rows).toEqual([
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
    expect(stats.brought.rows).toEqual([
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
    expect(stats.leadPairs.rows).toEqual([
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
    expect(stats.leads.rows).toEqual([
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
