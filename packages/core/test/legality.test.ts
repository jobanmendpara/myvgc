import { describe, expect, it } from 'vitest'
import {
  type LegalityBuild,
  REGULATIONS,
  REGULATION_MODS,
  buildProblems,
  judgeTeam,
  moveProblems,
  teamProblems,
  wholeBuildProblems,
} from '../src'

const build = (species: string, rest: Partial<LegalityBuild> = {}): LegalityBuild => ({
  species,
  ...rest,
})

describe('REGULATION_MODS', () => {
  it('says for every Regulation which rules hold, or that it has none', () => {
    for (const regulation of REGULATIONS) {
      expect(Object.keys(REGULATION_MODS)).toContain(regulation)
    }
  })

  it('reads M-C from the latest mod, M-B from its own, and has no rules for M-A', () => {
    expect(REGULATION_MODS).toEqual({ 'M-A': null, 'M-B': 'championsregmb', 'M-C': 'champions' })
  })
})

describe('judgeTeam', () => {
  it('leaves a Team in a Regulation with no rules unchecked, however it looks', () => {
    expect(judgeTeam([build('incineroar'), build('incineroar')], 'M-A')).toEqual({
      regulation: 'M-A',
      status: 'unchecked',
      problems: [],
    })
  })

  it('calls a Team that breaks no rule legal', () => {
    const team = [
      build('incineroar', { item: 'sitrusberry', ability: 'intimidate' }),
      build('rotomwash', { item: 'leftovers', ability: 'levitate' }),
    ]
    expect(judgeTeam(team, 'M-C')).toEqual({ regulation: 'M-C', status: 'legal', problems: [] })
  })

  it('flags a species or form the Regulation does not allow, by Regulation', () => {
    // Salamence came back in M-C.
    expect(judgeTeam([build('incineroar'), build('salamence')], 'M-B')).toEqual({
      regulation: 'M-B',
      status: 'illegal',
      problems: [
        { path: ['pokemon', 1, 'species'], message: "Salamence isn't allowed in Reg M-B." },
      ],
    })
    expect(judgeTeam([build('salamence')], 'M-C').status).toBe('legal')
  })

  it('flags banned categories, saying which', () => {
    expect(judgeTeam([build('meloettapirouette')], 'M-C').problems).toEqual([
      {
        path: ['pokemon', 0, 'species'],
        message: 'Meloetta-Pirouette is a Mythical Pokémon, banned in Reg M-C.',
      },
    ])
    expect(judgeTeam([build('terapagosterastal')], 'M-C').problems).toEqual([
      {
        path: ['pokemon', 0, 'species'],
        message: 'Terapagos-Terastal is a Restricted Legendary Pokémon, banned in Reg M-C.',
      },
    ])
  })

  it('does not ban Sub-Legendary Pokémon', () => {
    expect(judgeTeam([build('ogerpontealtera')], 'M-C').status).toBe('legal')
  })

  it('flags an ID the data no longer has, rather than failing', () => {
    expect(judgeTeam([build('notapokemon', { ability: 'levitate' })], 'M-C').problems).toEqual([
      { path: ['pokemon', 0, 'species'], message: "notapokemon isn't allowed in Reg M-C." },
    ])
  })

  it('flags an ability the species can not have', () => {
    expect(judgeTeam([build('incineroar', { ability: 'levitate' })], 'M-C').problems).toEqual([
      { path: ['pokemon', 0, 'ability'], message: "Incineroar can't have Levitate." },
    ])
  })

  it('lets a Mega form have its own ability or the one it has before Mega Evolving', () => {
    for (const ability of ['toughclaws', 'blaze']) {
      expect(judgeTeam([build('charizardmegax', { ability })], 'M-C').status).toBe('legal')
    }
  })

  it('flags a move the species can not learn, next to that move', () => {
    const team = [build('incineroar', { moves: ['fakeout', 'psychic', 'protect', 'dragonclaw'] })]
    expect(judgeTeam(team, 'M-C')).toEqual({
      regulation: 'M-C',
      status: 'illegal',
      problems: [
        { path: ['pokemon', 0, 'moves', 1], message: "Incineroar can't learn Psychic." },
        { path: ['pokemon', 0, 'moves', 3], message: "Incineroar can't learn Dragon Claw." },
      ],
    })
  })

  it('gives a Mega or cosmetic form the moves of the form it comes from', () => {
    const team = [
      build('charizardmegay', { moves: ['dragonclaw', 'hurricane'] }),
      build('vivillonpolar', { moves: ['sleeppowder', 'hurricane'] }),
    ]
    expect(judgeTeam(team, 'M-C').status).toBe('legal')
    expect(judgeTeam([build('charizardmegax', { moves: ['fakeout'] })], 'M-C').problems).toEqual([
      { path: ['pokemon', 0, 'moves', 0], message: "Charizard-Mega-X can't learn Fake Out." },
    ])
  })

  it('reads learnsets by Regulation', () => {
    // Archaludon learned Metal Burst in M-B but not in M-C, and Slash the other way round.
    const team = [build('archaludon', { moves: ['metalburst', 'slash'] })]
    expect(judgeTeam(team, 'M-B').problems).toEqual([
      { path: ['pokemon', 0, 'moves', 1], message: "Archaludon can't learn Slash." },
    ])
    expect(judgeTeam(team, 'M-C').problems).toEqual([
      { path: ['pokemon', 0, 'moves', 0], message: "Archaludon can't learn Metal Burst." },
    ])
  })

  it('flags a move the data no longer has, by its ID', () => {
    expect(judgeTeam([build('incineroar', { moves: ['notamove'] })], 'M-C').problems).toEqual([
      { path: ['pokemon', 0, 'moves', 0], message: "Incineroar can't learn notamove." },
    ])
  })

  it('does not judge the moves of a species the data has no learnset for', () => {
    expect(judgeTeam([build('notapokemon', { moves: ['fakeout'] })], 'M-C').problems).toEqual([
      { path: ['pokemon', 0, 'species'], message: "notapokemon isn't allowed in Reg M-C." },
    ])
  })

  it('flags an item the Regulation does not allow, by Regulation', () => {
    const team = [build('incineroar', { item: 'rockyhelmet' })]
    expect(judgeTeam(team, 'M-B').problems).toEqual([
      { path: ['pokemon', 0, 'item'], message: "Rocky Helmet isn't allowed in Reg M-B." },
    ])
    expect(judgeTeam(team, 'M-C').status).toBe('legal')
  })

  it('skips a slot with no species yet', () => {
    expect(judgeTeam([{ species: null, item: 'rockyhelmet' }], 'M-B').status).toBe('legal')
  })

  it('flags Species Clause on the Team, counting forms as the same species', () => {
    const team = [build('rotomwash'), build('incineroar'), build('rotomheat'), build('rotomfan')]
    expect(judgeTeam(team, 'M-C')).toEqual({
      regulation: 'M-C',
      status: 'illegal',
      problems: [{ path: ['pokemon'], message: 'Species Clause: more than one Rotom.' }],
    })
  })

  it('flags Item Clause on the Team', () => {
    const team = [
      build('incineroar', { item: 'sitrusberry' }),
      build('rotomwash', { item: 'sitrusberry' }),
      build('pikachu', { item: 'leftovers' }),
    ]
    expect(judgeTeam(team, 'M-C').problems).toEqual([
      { path: ['pokemon'], message: 'Item Clause: more than one Sitrus Berry.' },
    ])
  })

  it('does not count names the data lacks as the same species', () => {
    const { problems } = judgeTeam([build('notapokemon'), build('notapokemontoo')], 'M-C')
    expect(problems.filter((problem) => problem.path.length === 1)).toEqual([])
  })
})

describe('splitting problems for display', () => {
  const legality = judgeTeam(
    [
      build('incineroar', { ability: 'levitate', item: 'leftovers' }),
      build('incineroar', { item: 'leftovers' }),
    ],
    'M-C',
  )

  it('gives each Pokémon build its own problems', () => {
    expect(buildProblems(legality, 0).map((problem) => problem.message)).toEqual([
      "Incineroar can't have Levitate.",
    ])
    expect(buildProblems(legality, 1)).toEqual([])
  })

  it('gives each move its own problems, apart from the rest of the build', () => {
    const problems = buildProblems(
      judgeTeam(
        [build('incineroar', { ability: 'levitate', moves: ['fakeout', 'psychic'] })],
        'M-C',
      ),
      0,
    )
    expect(moveProblems(problems, 1).map((problem) => problem.message)).toEqual([
      "Incineroar can't learn Psychic.",
    ])
    expect(moveProblems(problems, 0)).toEqual([])
    expect(wholeBuildProblems(problems).map((problem) => problem.message)).toEqual([
      "Incineroar can't have Levitate.",
    ])
  })

  it('keeps Team-wide problems apart', () => {
    expect(teamProblems(legality).map((problem) => problem.message)).toEqual([
      'Species Clause: more than one Incineroar.',
      'Item Clause: more than one Leftovers.',
    ])
  })
})
