import { describe, expect, it } from 'vitest'
import { searchOpponents, searchTeams, searchTournaments } from '../src/search'

const opponent = (displayName: string, aliases: string[] = []) => ({
  id: displayName,
  displayName,
  aliases,
})

const opponents = [
  opponent('Wolfe Glick', ['Wolfey']),
  opponent('John'),
  opponent('Aaron Zheng', ['Cybertron']),
  opponent('Sejun Park'),
]

const ids = (items: { id: string }[]) => items.map((item) => item.id)

describe('Searching a list', () => {
  it('finds a name typed with swapped letters', () => {
    expect(ids(searchOpponents(opponents, 'Jhon'))).toEqual(['John'])
  })

  it('returns the whole list in its usual order for an empty query', () => {
    const order = ['Wolfe Glick', 'John', 'Aaron Zheng', 'Sejun Park']
    expect(ids(searchOpponents(opponents, ''))).toEqual(order)
    expect(ids(searchOpponents(opponents, '   '))).toEqual(order)
  })

  it('ranks an exact match first, then names starting with the query, then fuzzy matches', () => {
    const players = [
      opponent('Jhonatan Silva'),
      opponent('Johnny Ace'),
      opponent('Sam', ['john']),
      opponent('Jonathan'),
    ]
    expect(ids(searchOpponents(players, 'john'))).toEqual(['Sam', 'Johnny Ace', 'Jhonatan Silva'])
  })

  it('ignores accents and the order of words', () => {
    const players = [opponent('Éric Rios'), opponent('Aaron Zheng')]
    expect(ids(searchOpponents(players, 'eric'))).toEqual(['Éric Rios'])
    expect(ids(searchOpponents(players, 'zheng aaron'))).toEqual(['Aaron Zheng'])
  })

  it('finds an Opponent by an Alias', () => {
    expect(ids(searchOpponents(opponents, 'cyber'))).toEqual(['Aaron Zheng'])
  })

  it('finds a Team by the species of a Pokémon build', () => {
    const team = (id: string, species: string[]) => ({
      id,
      name: id,
      pokemon: species.map((s) => ({ names: { species: s } })),
    })
    const teams = [team('Sun', ['Charizard', 'Venusaur']), team('Rain', ['Pelipper', 'Archaludon'])]
    expect(ids(searchTeams(teams, 'archaludn'))).toEqual(['Rain'])
  })

  it('finds a Tournament by its Organizer or location', () => {
    const tournament = (id: string, organizer: string | null, location: string | null) => ({
      id,
      name: id,
      organizer,
      location,
    })
    const tournaments = [
      tournament('Cup', 'Limitless', null),
      tournament('Regional', 'Play! Pokémon', 'Stuttgart'),
    ]
    expect(ids(searchTournaments(tournaments, 'limitles'))).toEqual(['Cup'])
    expect(ids(searchTournaments(tournaments, 'stutgart'))).toEqual(['Regional'])
  })
})
