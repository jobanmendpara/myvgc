import { BLANK_TEAM_FIELDS, type ReadTeamView, type TeamView } from '@myvgc/core/schema'
import { describe, expect, it } from 'vitest'
import { newTeamFields, readTeamToDraft, teamToDraft } from '../app/lib/team-form'

const randomName = /^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+$/

/** A Team read from a file with no Pokémon, named as given. */
const read = (name: string): ReadTeamView => ({ name, pokemon: [], flags: [] })

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
