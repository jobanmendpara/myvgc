import { Dex } from '@pkmn/dex'
import { describe, expect, it } from 'vitest'
import { MAX_TEAM_NAME_LENGTH, TEAM_NAME_WORDS, randomTeamName } from '../src/schema'

/** A random source that returns these numbers in turn. */
const sequence =
  (...numbers: number[]) =>
  () =>
    numbers.shift() ?? 0

describe('A random Team name', () => {
  it('is three Title Case words separated by spaces', () => {
    for (let i = 0; i < 100; i++) {
      expect(randomTeamName()).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+$/)
    }
  })

  it('takes one word from each list, chosen by the random source', () => {
    const [first, second, third] = TEAM_NAME_WORDS
    expect(randomTeamName(sequence(0, 0, 0))).toBe(`${first[0]} ${second[0]} ${third[0]}`)
    expect(randomTeamName(sequence(0.9999, 0.9999, 0.9999))).toBe(
      `${first.at(-1)} ${second.at(-1)} ${third.at(-1)}`,
    )
  })

  it('stays well under the longest Team name', () => {
    const longest = TEAM_NAME_WORDS.map((words) =>
      words.reduce((a, b) => (b.length > a.length ? b : a)),
    ).join(' ')
    expect(longest.length).toBeLessThan(MAX_TEAM_NAME_LENGTH / 2)
  })

  it('never repeats a word within a list', () => {
    for (const words of TEAM_NAME_WORDS) expect(new Set(words).size).toBe(words.length)
  })

  it('uses no Pokémon, move, ability, item, Stat Alignment or type name', () => {
    const pokemonTerms = TEAM_NAME_WORDS.flat().filter((word) =>
      [Dex.species, Dex.moves, Dex.abilities, Dex.items, Dex.natures, Dex.types].some(
        (table) => table.get(word).exists,
      ),
    )
    expect(pokemonTerms).toEqual([])
  })
})
