import { describe, expect, it } from 'vitest'
import { type SummaryRound, type SummaryTournament, summarize } from '../src/schema'

let nextId = 0
const tournament = (overrides: Partial<SummaryTournament> = {}): SummaryTournament => ({
  id: `t${++nextId}`,
  name: `Tournament ${nextId}`,
  startDate: '2026-10-01',
  createdAt: '2026-10-01T00:00:00.000Z',
  playerCount: null,
  placement: null,
  championshipPoints: null,
  entryFee: null,
  team: null,
  rounds: [],
  ...overrides,
})
const wolfe = { id: 'o1', displayName: 'Wolfe' }
const aaron = { id: 'o2', displayName: 'Aaron' }
const round = (
  result: SummaryRound['result'],
  overrides: Partial<SummaryRound> = {},
): SummaryRound => ({
  phase: 'swiss',
  bestOf: 1,
  bye: false,
  result,
  gameScore: null,
  opponent: wolfe,
  ...overrides,
})
const bye = () => round('win', { bye: true, opponent: null })

describe('summarize', () => {
  it('is empty when there is nothing to summarise', () => {
    const summary = summarize([])
    expect(summary).toMatchObject({
      tournamentsPlayed: 0,
      rounds: { wins: 0, losses: 0, ties: 0, winRate: null },
      games: null,
      topCut: { made: 0, of: 0, rate: null },
      championshipPoints: [],
      entryFees: [],
      byTeam: [],
      opponents: [],
      bestPlacements: [],
      includesPartialSeason: false,
    })
  })

  it('leaves Byes out of win rates, and counts Ties as Rounds not won', () => {
    const summary = summarize([
      tournament({ rounds: [bye(), round('win'), round('loss'), round('tie')] }),
    ])
    expect(summary.tournamentsPlayed).toBe(1)
    expect(summary.rounds).toEqual({ wins: 1, losses: 1, ties: 1, winRate: 1 / 3 })
  })

  it('works out the Game win rate from Rounds with a Game score only', () => {
    const summary = summarize([
      tournament({
        rounds: [
          round('win', { bestOf: 3, gameScore: { won: 2, lost: 1 } }),
          round('loss', { bestOf: 3, gameScore: { won: 0, lost: 2 } }),
          round('win', { bestOf: 3 }),
        ],
      }),
    ])
    expect(summary.games).toEqual({ won: 2, lost: 3, winRate: 0.4 })
  })

  it('counts Top cut out of Tournaments with Rounds, leaving out Upcoming ones', () => {
    const summary = summarize([
      tournament({ rounds: [round('win'), round('loss', { phase: 'top-cut' })] }),
      tournament({ rounds: [round('loss')] }),
      tournament({ rounds: [round('win')] }),
      tournament({ rounds: [] }),
    ])
    expect(summary.topCut).toEqual({ made: 1, of: 3, rate: 1 / 3 })
    expect(summary.tournamentsPlayed).toBe(3)
  })

  it('splits win rates by Swiss and Top cut, and by best of 1 and 3', () => {
    const summary = summarize([
      tournament({
        rounds: [
          round('win'),
          round('loss'),
          round('win', { phase: 'top-cut', bestOf: 3 }),
          round('loss', { phase: 'top-cut', bestOf: 3 }),
          round('loss', { phase: 'top-cut', bestOf: 3 }),
        ],
      }),
    ])
    expect(summary.byPhase.swiss).toEqual({ wins: 1, losses: 1, ties: 0, winRate: 0.5 })
    expect(summary.byPhase.topCut.winRate).toBeCloseTo(1 / 3)
    expect(summary.byBestOf[1]).toEqual({ wins: 1, losses: 1, ties: 0, winRate: 0.5 })
    expect(summary.byBestOf[3]).toMatchObject({ wins: 1, losses: 2 })
  })

  it('totals Championship Points per Season, with Tournaments before Champions on their own', () => {
    const summary = summarize([
      tournament({ startDate: '2026-05-01', championshipPoints: 50 }),
      tournament({ startDate: '2026-08-29', championshipPoints: 200 }),
      tournament({ startDate: '2026-09-19', championshipPoints: 80 }),
      tournament({ startDate: '2026-01-10', championshipPoints: 10 }),
      tournament({ startDate: '2026-10-01', championshipPoints: null }),
    ])
    expect(summary.championshipPoints).toEqual([
      { season: null, points: 10 },
      { season: { id: '2026', name: '2026 Season', partial: true }, points: 250 },
      { season: { id: '2027', name: '2027 Season', partial: false }, points: 80 },
    ])
    expect(summary.includesPartialSeason).toBe(true)
  })

  it('totals Entry fees per currency, including Upcoming Tournaments, and never converts', () => {
    const summary = summarize([
      tournament({ entryFee: { amount: 3500, currency: 'USD' }, rounds: [round('win')] }),
      tournament({ entryFee: { amount: 2000, currency: 'USD' } }),
      tournament({ entryFee: { amount: 3000, currency: 'JPY' } }),
    ])
    expect(summary.entryFees).toEqual([
      { currency: 'JPY', amount: 3000, tournaments: 1 },
      { currency: 'USD', amount: 5500, tournaments: 2 },
    ])
  })

  it('groups performance by the original Team, falling back to the snapshot when it was deleted', () => {
    const sun = { teamId: 'team-sun', name: 'Sun' }
    const summary = summarize([
      tournament({ team: sun, rounds: [round('win'), round('win')] }),
      tournament({
        startDate: '2026-11-01',
        team: { teamId: 'team-sun', name: 'Sun v2' },
        rounds: [round('loss')],
      }),
      tournament({ team: { teamId: null, name: 'Old rain' }, rounds: [round('loss'), bye()] }),
      tournament({ team: null, rounds: [round('win')] }),
    ])
    expect(summary.byTeam).toEqual([
      {
        teamId: 'team-sun',
        name: 'Sun v2',
        tournaments: 2,
        wins: 2,
        losses: 1,
        ties: 0,
        winRate: 2 / 3,
      },
      { teamId: null, name: 'Old rain', tournaments: 1, wins: 0, losses: 1, ties: 0, winRate: 0 },
    ])
  })

  it('lists the most-played Opponents with Head-to-head records', () => {
    const summary = summarize([
      tournament({ rounds: [round('win', { opponent: aaron }), round('loss'), bye()] }),
      tournament({ rounds: [round('tie')] }),
    ])
    expect(summary.opponents).toEqual([
      { id: 'o1', displayName: 'Wolfe', rounds: 2, wins: 0, losses: 1, ties: 1 },
      { id: 'o2', displayName: 'Aaron', rounds: 1, wins: 1, losses: 0, ties: 0 },
    ])
  })

  it('lists the best Placements, the more recent first when they tie', () => {
    const summary = summarize([
      tournament({ name: 'Ninth', startDate: '2026-05-01', placement: 9, playerCount: 128 }),
      tournament({ name: 'Old third', startDate: '2026-05-02', placement: 3 }),
      tournament({ name: 'New third', startDate: '2026-09-02', placement: 3 }),
      tournament({ name: 'None' }),
    ])
    expect(summary.bestPlacements.map((p) => [p.name, p.placement, p.playerCount])).toEqual([
      ['New third', 3, null],
      ['Old third', 3, null],
      ['Ninth', 9, 128],
    ])
  })
})
