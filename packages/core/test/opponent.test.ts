import { describe, expect, it } from 'vitest'
import {
  MAX_ALIASES,
  MAX_NOTES_LENGTH,
  type MergeableOpponent,
  type OpponentRoundView,
  type PokemonBuild,
  groupByTournament,
  mergeOpponents,
} from '../src/schema'

const opponent = (overrides: Partial<MergeableOpponent> = {}): MergeableOpponent => ({
  displayName: 'Wolfe Glick',
  aliases: [],
  notes: '',
  ...overrides,
})

describe('mergeOpponents', () => {
  it("keeps the survivor's Aliases and adds the duplicate's name and Aliases", () => {
    const merged = mergeOpponents(
      opponent({ aliases: ['wolfey'] }),
      opponent({ displayName: 'WolfeyVGC', aliases: ['Wolfe G.'] }),
    )
    expect(merged).toEqual({ ok: true, aliases: ['wolfey', 'WolfeyVGC', 'Wolfe G.'], notes: '' })
  })

  it("drops repeats in any case, keeping the survivor's spelling, and the survivor's own name", () => {
    const merged = mergeOpponents(
      opponent({ aliases: ['wolfey'] }),
      opponent({ displayName: 'WOLFEY', aliases: ['wolfe glick', 'Wolfey', 'vgc'] }),
    )
    expect(merged).toMatchObject({ ok: true, aliases: ['wolfey', 'vgc'] })
  })

  it("puts the duplicate's notes after the survivor's, under its name", () => {
    const merged = mergeOpponents(
      opponent({ notes: 'Leads Incineroar' }),
      opponent({ displayName: 'wolfey', notes: 'Loves Trick Room' }),
    )
    expect(merged).toMatchObject({
      ok: true,
      notes: 'Leads Incineroar\n\n---\n\n**From wolfey:**\n\nLoves Trick Room',
    })
  })

  it('adds nothing for empty notes on either side', () => {
    expect(mergeOpponents(opponent({ notes: 'Mine' }), opponent())).toMatchObject({
      notes: 'Mine',
    })
    expect(
      mergeOpponents(opponent(), opponent({ displayName: 'wolfey', notes: 'Theirs' })),
    ).toMatchObject({ notes: '**From wolfey:**\n\nTheirs' })
  })

  it('refuses a merge with too many Aliases, saying how many to remove', () => {
    const many = (prefix: string) => Array.from({ length: 10 }, (_, i) => `${prefix}${i}`)
    const merged = mergeOpponents(
      opponent({ aliases: many('a') }),
      opponent({ displayName: 'b', aliases: many('c') }),
    )
    expect(merged.ok).toBe(false)
    if (merged.ok) return
    expect(merged.issues).toEqual([
      {
        path: ['aliases'],
        message: `Together they’d have ${MAX_ALIASES + 1} Aliases, and an Opponent can have at most ${MAX_ALIASES}. Remove 1 first.`,
      },
    ])
  })

  it('refuses a merge whose notes would be too long', () => {
    const merged = mergeOpponents(
      opponent({ notes: 'a'.repeat(MAX_NOTES_LENGTH / 2) }),
      opponent({ displayName: 'wolfey', notes: 'b'.repeat(MAX_NOTES_LENGTH / 2) }),
    )
    expect(merged).toMatchObject({ ok: false, issues: [{ path: ['notes'] }] })
  })
})

const tournaments = {
  toronto: { id: 't1', name: 'Toronto Regional', startDate: '2026-09-19', regulation: 'M-C' },
  online: { id: 't2', name: 'Online Challenge', startDate: '2026-10-03', regulation: 'M-C' },
} as const

const round = (
  tournament: OpponentRoundView['tournament'],
  overrides: Partial<OpponentRoundView> = {},
): OpponentRoundView => ({
  id: `r-${Math.random()}`,
  tournamentId: tournament.id,
  phase: 'swiss',
  roundNumber: 1,
  stage: null,
  bestOf: 3,
  bye: false,
  result: 'win',
  gameScore: null,
  opponent: { id: 'o1', displayName: 'Wolfe Glick' },
  notes: '',
  games: [],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  tournament,
  ...overrides,
})

const NO_POINTS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
const mon = (species: string): PokemonBuild => ({ species, moves: [], statPoints: NO_POINTS })

describe('groupByTournament', () => {
  it('puts the newest Tournament first, each with its Opponent’s Team', () => {
    const groups = groupByTournament({
      rounds: [round(tournaments.toronto), round(tournaments.online)],
      opponentTeams: [{ tournamentId: 't1', pokemon: [mon('incineroar')] }],
    })
    expect(groups.map((g) => [g.tournament.name, g.opponentTeam])).toEqual([
      ['Online Challenge', null],
      ['Toronto Regional', [mon('incineroar')]],
    ])
  })

  it('orders Rounds as they were played and tallies the Head-to-head record there', () => {
    const [group] = groupByTournament({
      rounds: [
        round(tournaments.toronto, {
          phase: 'top-cut',
          roundNumber: null,
          stage: 'top-8',
          result: 'loss',
        }),
        round(tournaments.toronto, { roundNumber: 6 }),
        round(tournaments.toronto, { roundNumber: 2, result: 'tie' }),
      ],
      opponentTeams: [],
    })
    expect(group!.rounds.map((r) => r.roundNumber ?? r.stage)).toEqual([2, 6, 'top-8'])
    expect(group!.headToHead).toEqual({ wins: 1, losses: 1, ties: 1 })
  })

  it('gives nothing for an Opponent with no Rounds', () => {
    expect(groupByTournament({ rounds: [], opponentTeams: [] })).toEqual([])
  })
})
