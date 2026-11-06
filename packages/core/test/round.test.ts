import { describe, expect, it } from 'vitest'
import {
  type GameNumber,
  type RoundFacts,
  type RoundResult,
  formatRecord,
  gameSchema,
  recordOf,
  roundIssues,
  roundResult,
  settleRound,
  suggestedPlacement,
} from '../src/schema'

const swiss = (overrides: Partial<RoundFacts> = {}): RoundFacts => ({
  phase: 'swiss',
  roundNumber: 1,
  stage: null,
  bestOf: 3,
  bye: false,
  result: 'win',
  gameScore: null,
  hasOpponent: true,
  games: [],
  ...overrides,
})
const topCut = (stage: RoundFacts['stage'], result: RoundFacts['result']): RoundFacts =>
  swiss({ phase: 'top-cut', roundNumber: null, stage, result })

describe('roundResult', () => {
  it('is the result the User chose when there is no Game score', () => {
    expect(roundResult(swiss({ result: 'loss' }))).toBe('loss')
  })

  it.each([
    [{ won: 2, lost: 0 }, 'win'],
    [{ won: 2, lost: 1 }, 'win'],
    [{ won: 1, lost: 2 }, 'loss'],
    [{ won: 0, lost: 2 }, 'loss'],
    [{ won: 1, lost: 1 }, 'tie'],
    [{ won: 1, lost: 0 }, 'win'],
  ] as const)('is decided by a Game score of %j', (gameScore, result) => {
    expect(roundResult(swiss({ gameScore, result: 'tie' }))).toBe(result)
  })

  it('is always a win for a Bye', () => {
    expect(roundResult(swiss({ bye: true, hasOpponent: false, result: null }))).toBe('win')
  })
})

describe('roundIssues', () => {
  it('accepts an ordinary Round and a Bye', () => {
    expect(roundIssues(swiss())).toEqual([])
    expect(roundIssues(swiss({ bye: true, hasOpponent: false, result: null }))).toEqual([])
  })

  it.each<[string, Partial<RoundFacts>, string]>([
    ['no Opponent', { hasOpponent: false }, 'opponent'],
    ['a Bye with an Opponent', { bye: true }, 'opponent'],
    [
      'a Bye with a Game score',
      { bye: true, hasOpponent: false, gameScore: { won: 2, lost: 0 } },
      'gameScore',
    ],
    ['no result and no Game score', { result: null }, 'result'],
    ['a Game score in best of 1', { bestOf: 1, gameScore: { won: 1, lost: 0 } }, 'gameScore'],
    ['more than two Games won', { gameScore: { won: 3, lost: 0 } }, 'gameScore'],
    ['more than three Games', { gameScore: { won: 2, lost: 2 } }, 'gameScore'],
    ['a Swiss Round with no number', { roundNumber: null }, 'roundNumber'],
    ['a Swiss Round with a stage', { stage: 'top-8' }, 'stage'],
    ['a Top cut Round with no stage', { phase: 'top-cut', roundNumber: null }, 'stage'],
    ['a Top cut Round with a number', { phase: 'top-cut', stage: 'top-8' }, 'roundNumber'],
  ])('refuses %s', (_, overrides, field) => {
    expect(roundIssues(swiss(overrides)).map((issue) => issue.path[0])).toContain(field)
  })
})

// Games with these results, numbered from 1. `null` is a Game with no result recorded.
const games = (...results: (RoundResult | null)[]) =>
  results.map((result, index) => ({ number: (index + 1) as GameNumber, result }))
const fields = (round: RoundFacts) => roundIssues(round).map((issue) => issue.path[0])

describe('Games in a Round', () => {
  it.each<[string, (RoundResult | null)[], { won: number; lost: number }]>([
    ['2-0', ['win', 'win'], { won: 2, lost: 0 }],
    ['2-1', ['win', 'loss', 'win'], { won: 2, lost: 1 }],
    ['0-2', ['loss', 'loss'], { won: 0, lost: 2 }],
    ['1-1 with a tied Game 3', ['win', 'loss', 'tie'], { won: 1, lost: 1 }],
  ])('fill in a Game score of %s once they decide the Round', (_, results, gameScore) => {
    const round = swiss({ result: null, games: games(...results) })
    expect(roundIssues(round)).toEqual([])
    expect(settleRound(round).gameScore).toEqual(gameScore)
  })

  it('leave the Game score and result to the User while they are partial', () => {
    const round = swiss({ result: 'win', games: games('win', null, 'win') })
    expect(roundIssues(round)).toEqual([])
    expect(settleRound(round)).toMatchObject({ result: 'win', gameScore: null })
    expect(fields(swiss({ result: null, games: games('win') }))).toEqual(['result'])
  })

  it('must agree with a Game score or result the User gave', () => {
    expect(fields(swiss({ gameScore: { won: 2, lost: 1 }, games: games('win', 'win') }))).toEqual([
      'gameScore',
    ])
    expect(fields(swiss({ gameScore: { won: 2, lost: 1 }, games: games('loss', 'loss') }))).toEqual(
      ['gameScore'],
    )
    expect(fields(swiss({ result: 'win', games: games('loss', 'loss') }))).toEqual(['result'])
    expect(
      roundIssues(swiss({ gameScore: { won: 2, lost: 1 }, games: games('win', 'loss') })),
    ).toEqual([])
  })

  it('refuse a Game after the Round was decided', () => {
    expect(fields(swiss({ result: null, games: games('win', 'win', 'loss') }))).toContain('games')
  })

  it('decide a best-of-1 Round, unless the User chose another result', () => {
    const round = swiss({ bestOf: 1, result: null, games: games('loss') })
    expect(roundIssues(round)).toEqual([])
    expect(roundResult(settleRound(round))).toBe('loss')
    expect(fields(swiss({ bestOf: 1, result: 'win', games: games('loss') }))).toEqual(['result'])
  })

  it('are never dropped when best-of changes: Games beyond it are refused on best-of', () => {
    expect(fields(swiss({ bestOf: 1, games: games(null, null, 'win') }))).toEqual(['bestOf'])
  })

  it('are refused on a Bye', () => {
    expect(fields(swiss({ bye: true, hasOpponent: false, games: games(null) }))).toEqual(['games'])
  })
})

describe('gameSchema', () => {
  it('accepts a Game with nothing recorded, and fills in empty fields', () => {
    expect(gameSchema.parse({ number: 2 })).toEqual({
      number: 2,
      brought: [],
      leads: [],
      opponentBrought: [],
      opponentLeads: [],
      result: null,
      notes: '',
    })
  })

  it('needs each Lead to be one of the Brought Pokémon, and no Pokémon twice', () => {
    const parsed = gameSchema.safeParse({
      number: 1,
      brought: ['incineroar', 'rillaboom', 'incineroar'],
      leads: ['incineroar'],
      opponentBrought: ['kingambit'],
      opponentLeads: ['whimsicott'],
    })
    expect(parsed.error?.issues.map((issue) => issue.path)).toEqual([
      ['brought', 2],
      ['opponentLeads', 0],
    ])
  })

  it('allows at most 4 Brought Pokémon and 2 Leads a side', () => {
    const parsed = gameSchema.safeParse({
      number: 1,
      brought: ['a', 'b', 'c', 'd', 'e'],
      opponentLeads: ['a', 'b', 'c'],
    })
    expect(parsed.error?.issues.map((issue) => issue.path[0])).toEqual(
      expect.arrayContaining(['brought', 'opponentLeads']),
    )
  })
})

describe('recordOf', () => {
  it('counts Swiss and Top cut separately, with Byes as wins', () => {
    const rounds = [
      swiss({ roundNumber: 1, bye: true, hasOpponent: false, result: null }),
      swiss({ roundNumber: 2, result: 'win' }),
      swiss({ roundNumber: 3, result: 'loss' }),
      swiss({ roundNumber: 4, gameScore: { won: 1, lost: 1 } }),
      topCut('top-8', 'win'),
      topCut('top-4', 'loss'),
    ]
    expect(recordOf(rounds)).toEqual({
      swiss: { wins: 2, losses: 1, ties: 1 },
      topCut: { wins: 1, losses: 1, ties: 0 },
    })
  })

  it('writes a record as wins-losses-ties', () => {
    expect(formatRecord({ wins: 6, losses: 2, ties: 0 })).toBe('6-2-0')
  })
})

describe('suggestedPlacement', () => {
  it.each([
    ['finals', 'loss', 2],
    ['finals', 'win', 1],
    ['top-4', 'loss', 3],
    ['top-8', 'loss', 5],
    ['top-16', 'loss', 9],
    ['top-32', 'loss', 17],
    ['top-64', 'loss', 33],
  ] as const)('suggests a Placement after a %s %s', (stage, result, placement) => {
    expect(suggestedPlacement([topCut('top-8', 'win'), topCut(stage, result)])).toBe(placement)
  })

  it('suggests nothing while the User is still in Top cut, or never made it', () => {
    expect(suggestedPlacement([swiss(), topCut('top-8', 'win')])).toBeUndefined()
    expect(suggestedPlacement([swiss({ result: 'loss' })])).toBeUndefined()
  })
})
