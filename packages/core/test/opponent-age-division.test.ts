import { describe, expect, it } from 'vitest'
import {
  type RoundFacts,
  latestOpponentAgeDivision,
  losesOpponentAgeDivision,
  opponentAgeDivisionOf,
  roundInputSchema,
  roundIssues,
} from '../src/schema'

describe('an Opponent’s Age Division on the Round input', () => {
  it('takes Junior, Senior or Masters, or null to clear it', () => {
    expect(roundInputSchema.parse({ opponentAgeDivision: 'Senior' }).opponentAgeDivision).toBe(
      'Senior',
    )
    expect(roundInputSchema.parse({ opponentAgeDivision: null }).opponentAgeDivision).toBeNull()
    expect(roundInputSchema.parse({}).opponentAgeDivision).toBeUndefined()
  })

  it('refuses anything else', () => {
    const read = roundInputSchema.safeParse({ opponentAgeDivision: 'Adult' })
    expect(read.success).toBe(false)
    expect(read.error?.issues[0]?.message).toBe('Choose Junior, Senior or Masters.')
  })
})

describe('roundIssues with an Opponent’s Age Division', () => {
  const facts: RoundFacts = {
    phase: 'swiss',
    roundNumber: 1,
    stage: null,
    bestOf: 1,
    bye: false,
    result: 'win',
    gameScore: null,
    hasOpponent: true,
    games: [],
    hasOpponentTeam: false,
    hasOpponentAgeDivision: true,
  }
  const paths = (round: RoundFacts) => roundIssues(round).map((issue) => issue.path.join('.'))

  it('is fine with an Opponent', () => {
    expect(paths(facts)).toEqual([])
  })

  it('is refused on a Bye, or before an Opponent is chosen', () => {
    expect(paths({ ...facts, bye: true, hasOpponent: false, result: null })).toEqual([
      'opponentAgeDivision',
    ])
    expect(paths({ ...facts, hasOpponent: false })).toEqual(['opponent', 'opponentAgeDivision'])
  })
})

describe('opponentAgeDivisionOf', () => {
  it('finds an Opponent’s Age Division among a Tournament’s', () => {
    const divisions = [{ opponentId: 'wolfe', ageDivision: 'Junior' as const }]
    expect(opponentAgeDivisionOf(divisions, 'wolfe')).toBe('Junior')
    expect(opponentAgeDivisionOf(divisions, 'aaron')).toBeNull()
    expect(opponentAgeDivisionOf(divisions, undefined)).toBeNull()
  })
})

describe('latestOpponentAgeDivision', () => {
  const wolfe = 'wolfe'
  const tournament = (
    id: string,
    startDate: string,
    ageDivision: 'Junior' | 'Senior' | 'Masters' = 'Junior',
  ) => ({ id, startDate, opponentAgeDivisions: [{ opponentId: wolfe, ageDivision }] })

  it('takes theirs from the latest other Tournament in the same Season', () => {
    const found = latestOpponentAgeDivision(
      [
        tournament('older', '2026-09-01', 'Junior'),
        tournament('last-season', '2026-08-20', 'Masters'),
        tournament('latest', '2026-10-01', 'Senior'),
        tournament('this-one', '2026-11-01', 'Masters'),
      ],
      { opponentId: wolfe, tournamentId: 'this-one', startDate: '2026-11-01' },
    )
    expect(found?.tournament.id).toBe('latest')
    expect(found?.ageDivision).toBe('Senior')
  })

  it('offers nothing across Seasons, as they may have aged up', () => {
    expect(
      latestOpponentAgeDivision([tournament('a', '2026-08-20')], {
        opponentId: wolfe,
        tournamentId: 'b',
        startDate: '2026-09-01',
      }),
    ).toBeUndefined()
  })

  it('offers nothing when the Opponent has none recorded', () => {
    expect(
      latestOpponentAgeDivision([tournament('a', '2026-09-01')], {
        opponentId: 'someone-else',
        tournamentId: 'b',
        startDate: '2026-10-01',
      }),
    ).toBeUndefined()
  })

  it('offers nothing for a date before any Season', () => {
    expect(
      latestOpponentAgeDivision([tournament('a', '2026-01-01')], {
        opponentId: wolfe,
        tournamentId: 'b',
        startDate: '2026-01-02',
      }),
    ).toBeUndefined()
  })
})

describe('losesOpponentAgeDivision', () => {
  const tournament = {
    rounds: [
      { id: 'r1', opponent: { id: 'wolfe' } },
      { id: 'r2', opponent: { id: 'wolfe' } },
      { id: 'r3', opponent: { id: 'aaron' } },
    ],
    opponentAgeDivisions: [
      { opponentId: 'wolfe', ageDivision: 'Junior' as const },
      { opponentId: 'aaron', ageDivision: 'Masters' as const },
    ],
  }

  it('is true when no other Round in the Tournament is against them', () => {
    expect(losesOpponentAgeDivision(tournament, 'r3', 'aaron')).toBe(true)
  })

  it('is false while another Round is against them, or when they have none there', () => {
    expect(losesOpponentAgeDivision(tournament, 'r1', 'wolfe')).toBe(false)
    expect(
      losesOpponentAgeDivision({ ...tournament, opponentAgeDivisions: [] }, 'r3', 'aaron'),
    ).toBe(false)
    expect(losesOpponentAgeDivision(tournament, 'r3', undefined)).toBe(false)
  })
})
