import { describe, expect, it } from 'vitest'
import {
  type RoundFacts,
  formatRecord,
  recordOf,
  roundIssues,
  roundResult,
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
