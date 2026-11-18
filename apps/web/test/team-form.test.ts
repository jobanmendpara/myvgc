import { BLANK_TEAM_FIELDS, type ReadTeamView, type TeamView } from '@myvgc/core/schema'
import { describe, expect, it } from 'vitest'
import { newTeamFields, readTeamToDraft, teamToDraft } from '../app/lib/team-form'

const randomName = /^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+$/

/** A Team read from a file with no Pokémon, named as given. */
const read = (name: string): ReadTeamView => ({ name, replicaTeamId: '', pokemon: [], flags: [] })

describe("A Team form's name", () => {
  it('starts with a random name for a new Team', () => {
    expect(teamToDraft().name).toMatch(randomName)
  })

  it("starts a new Team's fields blank but for a random name", () => {
    expect(newTeamFields()).toEqual({
      ...BLANK_TEAM_FIELDS,
      name: expect.stringMatching(randomName),
    })
  })

  it("keeps an existing Team's name", () => {
    const team = { name: 'Sun Room', regulation: 'M-C', notes: '', replicaTeamId: '', pokemon: [] }
    expect(teamToDraft(team as unknown as TeamView).name).toBe('Sun Room')
  })

  it('keeps the name read from a file, and makes one when none was read', () => {
    expect(readTeamToDraft(read('Worlds Team')).name).toBe('Worlds Team')
    expect(readTeamToDraft(read('')).name).toMatch(randomName)
    expect(readTeamToDraft(read('  ')).name).toMatch(randomName)
  })
})

describe('A Team read from a file', () => {
  const charizard = {
    species: 'charizard',
    moves: [],
    statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    names: { species: 'Charizard', moves: [] },
  }

  it('fills the Replica Team ID read', () => {
    expect(readTeamToDraft({ ...read(''), replicaTeamId: '9TCG84KWXK' }).replicaTeamId).toBe(
      '9TCG84KWXK',
    )
  })

  it("keeps flags about the Team as a whole on the Team, and each Pokémon's on its slot", () => {
    const draft = readTeamToDraft({
      ...read(''),
      pokemon: [charizard],
      flags: [
        {
          path: ['replicaTeamId'],
          message: '"9TCG_84KWXK" isn\'t a Replica Team ID, so it was left blank.',
        },
        { path: ['pokemon', 0, 'item'], message: 'Couldn\'t read "Charcoal Biscuit".' },
        { path: ['images'], message: "Image 3 isn't a Replica Team or Pokémon detail screen." },
      ],
    })

    expect(draft.readFlags).toEqual([
      '"9TCG_84KWXK" isn\'t a Replica Team ID, so it was left blank.',
      "Image 3 isn't a Replica Team or Pokémon detail screen.",
    ])
    expect(draft.pokemon[0]!.readFlags).toEqual(['Couldn\'t read "Charcoal Biscuit".'])
  })

  it('has no Team flags on a Team that was not read', () => {
    expect(teamToDraft().readFlags).toEqual([])
  })
})
