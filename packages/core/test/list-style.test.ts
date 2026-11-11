import { describe, expect, it } from 'vitest'
import { groupOpponents, groupTeams, groupTournaments } from '../src/schema'

const labelsAndIds = (groups: { label: string; items: { id: string }[] }[]) =>
  groups.map((group) => [group.label, group.items.map((item) => item.id)])

describe('The Grouped List style', () => {
  it('puts upcoming Tournaments first, then the rest by year, newest year first', () => {
    const tournaments = [
      { id: 'worlds', upcoming: true, startDate: '2027-08-20' },
      { id: 'regional', upcoming: true, startDate: '2026-12-05' },
      { id: 'cup', upcoming: false, startDate: '2026-09-19' },
      { id: 'old-cup', upcoming: false, startDate: '2025-11-01' },
      { id: 'challenge', upcoming: false, startDate: '2026-04-11' },
    ]
    expect(labelsAndIds(groupTournaments(tournaments))).toEqual([
      ['Upcoming', ['worlds', 'regional']],
      ['2026', ['cup', 'challenge']],
      ['2025', ['old-cup']],
    ])
  })

  it('groups Teams by Regulation, newest Regulation first, keeping their order', () => {
    const teams = [
      { id: 'a', regulation: 'M-A' as const },
      { id: 'c1', regulation: 'M-C' as const },
      { id: 'b', regulation: 'M-B' as const },
      { id: 'c2', regulation: 'M-C' as const },
    ]
    expect(labelsAndIds(groupTeams(teams))).toEqual([
      ['Regulation M-C', ['c1', 'c2']],
      ['Regulation M-B', ['b']],
      ['Regulation M-A', ['a']],
    ])
  })

  it('groups Opponents A–Z by the first letter of their display name', () => {
    const opponents = [
      { id: 'wolfe', displayName: 'Wolfe Glick' },
      { id: 'aaron', displayName: 'aaron' },
      { id: 'eric', displayName: 'Éric' },
      { id: 'ash', displayName: 'Ash' },
      { id: 'number', displayName: '2Pac' },
    ]
    expect(labelsAndIds(groupOpponents(opponents))).toEqual([
      ['A', ['aaron', 'ash']],
      ['E', ['eric']],
      ['W', ['wolfe']],
      ['#', ['number']],
    ])
  })

  it('makes no groups for an empty list', () => {
    expect(groupTournaments([])).toEqual([])
    expect(groupTeams([])).toEqual([])
    expect(groupOpponents([])).toEqual([])
  })
})
