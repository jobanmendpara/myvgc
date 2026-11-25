import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ITEM_ICON_FILES, TYPE_ICON_NUMBERS, championsNames } from '../src'

// The icon files the web app serves, written by `pnpm sprites:update` (ADR 32).
const ITEM_ICONS = new URL('../../../apps/web/public/item-icons/', import.meta.url)
const TYPE_ICONS = new URL('../../../apps/web/public/type-icons/', import.meta.url)

const itemIds = Object.keys(championsNames().items)

// The 18 types, in PokeAPI's order. Stellar is a type in the data, but only for
// Terastallization, which Champions doesn't have, so it needs no icon (DEV-216).
const TYPES = [
  'normal',
  'fighting',
  'flying',
  'poison',
  'ground',
  'rock',
  'bug',
  'ghost',
  'steel',
  'fire',
  'water',
  'grass',
  'electric',
  'psychic',
  'ice',
  'dragon',
  'dark',
  'fairy',
]

function webpFiles(folder: URL) {
  return readdirSync(folder).filter((name) => name !== 'NOTICE')
}

function isWebp(file: URL) {
  const head = readFileSync(file).subarray(0, 12)
  return head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP'
}

describe('ITEM_ICON_FILES', () => {
  it('has a row for every held item in Champions', () => {
    const missing = itemIds.filter((id) => !ITEM_ICON_FILES[id])
    // A @pkmn/mods bump added an item: add its row and run `pnpm sprites:update`.
    expect(missing).toEqual([])
  })

  it('has no row for anything that is not a held item in Champions', () => {
    const extra = Object.keys(ITEM_ICON_FILES).filter((id) => !itemIds.includes(id))
    expect(extra).toEqual([])
  })

  it('names a PokeAPI item file for each row', () => {
    for (const file of Object.values(ITEM_ICON_FILES)) expect(file).toMatch(/^[a-z0-9-]+\.png$/)
  })

  it('finds Leek under its old name, Stick', () => {
    expect(ITEM_ICON_FILES.leek).toBe('stick.png')
  })
})

describe('TYPE_ICON_NUMBERS', () => {
  it('numbers each of the 18 types as PokeAPI does, Normal 1 to Fairy 18, and not Stellar', () => {
    expect(TYPE_ICON_NUMBERS).toEqual(Object.fromEntries(TYPES.map((id, at) => [id, at + 1])))
  })
})

describe.each([
  { name: 'Item icon', folder: ITEM_ICONS, ids: () => Object.keys(ITEM_ICON_FILES) },
  { name: 'Type icon', folder: TYPE_ICONS, ids: () => Object.keys(TYPE_ICON_NUMBERS) },
])('the committed $name files', ({ folder, ids }) => {
  it('hold a WebP file for every row and nothing else but the notice', () => {
    // Run `pnpm sprites:update` to write them.
    expect(webpFiles(folder).sort()).toEqual(
      ids()
        .map((id) => `${id}.webp`)
        .sort(),
    )
    expect(readdirSync(folder)).toContain('NOTICE')
  })

  it('are WebP images', () => {
    for (const id of ids()) expect(isWebp(new URL(`${id}.webp`, folder))).toBe(true)
  })
})
