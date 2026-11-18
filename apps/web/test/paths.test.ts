import { describe, expect, it } from 'vitest'
import { editTournamentPath, newRoundPath, roundPath, tournamentPath } from '../app/lib/paths'

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
