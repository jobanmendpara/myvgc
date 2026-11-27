import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SPRITE_FILES, championsNames } from '../src'

// The Sprite files the web app serves, written by `pnpm sprites:update` (ADR 29).
const SPRITES = new URL('../../../apps/web/public/sprites/', import.meta.url)

const speciesIds = Object.keys(championsNames().species)

describe('SPRITE_FILES', () => {
  it('has a row for every Champions species and form', () => {
    const missing = speciesIds.filter((id) => !SPRITE_FILES[id])
    // A @pkmn/mods bump added a form: add its row and run `pnpm sprites:update`.
    expect(missing).toEqual([])
  })

  it('has no row for anything that is not a Champions species or form', () => {
    const extra = Object.keys(SPRITE_FILES).filter((id) => !speciesIds.includes(id))
    expect(extra).toEqual([])
  })

  it('names a PokeAPI Champions icon for each row', () => {
    for (const file of Object.values(SPRITE_FILES)) expect(file).toMatch(/^\d+(-[a-z-]+)?\.png$/)
  })

  it('gives every Alcremie the Strawberry Sweet, as Showdown records no sweet', () => {
    const alcremies = Object.entries(SPRITE_FILES).filter(([id]) => id.startsWith('alcremie'))
    expect(alcremies).toHaveLength(8)
    for (const [, file] of alcremies) expect(file).toMatch(/^869-[a-z-]+-strawberry-sweet\.png$/)
  })
})

describe('the committed Sprite files', () => {
  it('include a WebP file for every row', () => {
    const missing = Object.keys(SPRITE_FILES).filter(
      (id) => !existsSync(new URL(`${id}.webp`, SPRITES)),
    )
    // Run `pnpm sprites:update` to write them.
    expect(missing).toEqual([])
  })

  it('hold nothing but those files and the notice', () => {
    const expected = [...Object.keys(SPRITE_FILES).map((id) => `${id}.webp`), 'NOTICE'].sort()
    expect(readdirSync(SPRITES).sort()).toEqual(expected)
  })

  it('are WebP images', () => {
    for (const id of Object.keys(SPRITE_FILES)) {
      const head = readFileSync(new URL(`${id}.webp`, SPRITES)).subarray(0, 12)
      expect(head.toString('latin1', 0, 4)).toBe('RIFF')
      expect(head.toString('latin1', 8, 12)).toBe('WEBP')
    }
  })
})
