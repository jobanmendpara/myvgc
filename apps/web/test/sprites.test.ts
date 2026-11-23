import { describe, expect, it } from 'vitest'
import {
  MAX_SPRITE_SIZE,
  SPRITE_STYLES,
  SPRITE_SURFACES,
  rowSpecies,
  spriteSize,
  spriteUrl,
} from '../app/lib/sprites'

describe('Sprite files', () => {
  it("serves a species' Sprite from its Showdown ID", () => {
    expect(spriteUrl('incineroar')).toBe('/sprites/incineroar.webp')
  })

  it('serves a stored form its own Sprite, such as a Mega', () => {
    expect(spriteUrl('charizardmegax')).toBe('/sprites/charizardmegax.webp')
  })
})

describe('Sprite sizes', () => {
  it('sizes each surface in the Inline style', () => {
    expect(spriteSize('build-card', 'inline')).toBe(32)
    expect(spriteSize('build-slot', 'inline')).toBe(24)
    expect(spriteSize('team-row-grouped', 'inline')).toBe(16)
    expect(spriteSize('team-row-detailed', 'inline')).toBe(20)
    expect(spriteSize('opponent-team', 'inline')).toBe(20)
    expect(spriteSize('opponent-team-editor', 'inline')).toBe(24)
    expect(spriteSize('games-button', 'inline')).toBe(24)
    expect(spriteSize('statistics-row', 'inline')).toBe(24)
    expect(spriteSize('species-picker-choice', 'inline')).toBe(24)
    expect(spriteSize('species-picker-option', 'inline')).toBe(24)
  })

  it('shows Inline when no style is given', () => {
    expect(spriteSize('build-card')).toBe(spriteSize('build-card', 'inline'))
  })

  it(`never draws a Sprite larger than ${MAX_SPRITE_SIZE} px`, () => {
    for (const style of SPRITE_STYLES)
      for (const surface of SPRITE_SURFACES)
        expect(spriteSize(surface, style)).toBeLessThanOrEqual(MAX_SPRITE_SIZE)
  })
})

describe('Statistics rows', () => {
  it("shows a species row's one Sprite", () => {
    expect(rowSpecies('incineroar')).toEqual(['incineroar'])
  })

  it("shows a Lead pair's two Sprites, in order", () => {
    expect(rowSpecies('incineroar sneasler')).toEqual(['incineroar', 'sneasler'])
  })
})
