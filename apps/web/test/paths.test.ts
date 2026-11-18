import { describe, expect, it } from 'vitest'
import {
  editTeamPath,
  editTournamentPath,
  newRoundPath,
  opponentPath,
  roundPath,
  teamPath,
  tournamentPath,
} from '../app/lib/paths'

describe('Tournament and Round links', () => {
  it("links to a Tournament's page and its edit page", () => {
    expect(tournamentPath('tournament')).toBe('/tournaments/tournament')
    expect(editTournamentPath('tournament')).toBe('/tournaments/tournament/edit')
  })

  it('links to logging a new Round in a Tournament', () => {
    expect(newRoundPath('tournament')).toBe('/tournaments/tournament/rounds/new')
  })

  it("links to the Round's page in its Tournament", () => {
    expect(roundPath('tournament', 'round')).toBe('/tournaments/tournament/rounds/round')
  })
})

describe('Team and Opponent links', () => {
  it("links to a Team's page and its edit page", () => {
    expect(teamPath('team')).toBe('/teams/team')
    expect(editTeamPath('team')).toBe('/teams/team/edit')
  })

  it("links to an Opponent's page", () => {
    expect(opponentPath('opponent')).toBe('/opponents/opponent')
  })
})
