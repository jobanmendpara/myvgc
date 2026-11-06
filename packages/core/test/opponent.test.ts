import { describe, expect, it } from 'vitest'
import {
  MAX_ALIASES,
  MAX_NOTES_LENGTH,
  type MergeableOpponent,
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
