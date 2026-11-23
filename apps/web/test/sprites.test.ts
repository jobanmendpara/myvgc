import { describe, expect, it } from 'vitest'
import {
  MAX_SPRITE_SIZE,
  SPRITE_STYLES,
  SPRITE_SURFACES,
  parseSpriteStyles,
  rowSpecies,
  spritePageOf,
  spriteSize,
  spriteStyleOf,
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

  it('sizes each surface in the Leading slot style', () => {
    expect(spriteSize('build-card', 'leading-slot')).toBe(48)
    expect(spriteSize('build-slot', 'leading-slot')).toBe(40)
    expect(spriteSize('team-row-grouped', 'leading-slot')).toBe(24)
    expect(spriteSize('team-row-detailed', 'leading-slot')).toBe(28)
    expect(spriteSize('opponent-team', 'leading-slot')).toBe(40)
    expect(spriteSize('opponent-team-editor', 'leading-slot')).toBe(32)
    expect(spriteSize('games-button', 'leading-slot')).toBe(32)
    expect(spriteSize('statistics-row', 'leading-slot')).toBe(32)
    expect(spriteSize('species-picker-choice', 'leading-slot')).toBe(32)
    expect(spriteSize('species-picker-option', 'leading-slot')).toBe(32)
  })

  it('sizes each surface in the Stacked tiles style', () => {
    expect(spriteSize('build-card', 'stacked-tiles')).toBe(48)
    expect(spriteSize('build-slot', 'stacked-tiles')).toBe(40)
    expect(spriteSize('team-row-grouped', 'stacked-tiles')).toBe(32)
    expect(spriteSize('team-row-detailed', 'stacked-tiles')).toBe(40)
    expect(spriteSize('opponent-team', 'stacked-tiles')).toBe(48)
    expect(spriteSize('opponent-team-editor', 'stacked-tiles')).toBe(40)
    expect(spriteSize('games-button', 'stacked-tiles')).toBe(48)
    expect(spriteSize('statistics-row', 'stacked-tiles')).toBe(32)
    expect(spriteSize('species-picker-choice', 'stacked-tiles')).toBe(40)
    expect(spriteSize('species-picker-option', 'stacked-tiles')).toBe(32)
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

describe('Sprite pages', () => {
  it('gives each of the four pages its own Sprite style, by the first part of the path', () => {
    expect(spritePageOf('/teams')).toBe('teams')
    expect(spritePageOf('/teams/abc/edit')).toBe('teams')
    expect(spritePageOf('/opponents/abc')).toBe('opponents')
    expect(spritePageOf('/tournaments/abc/rounds/1')).toBe('tournaments')
    expect(spritePageOf('/statistics')).toBe('statistics')
  })

  it('has no Sprite style on pages that show no Sprites', () => {
    expect(spritePageOf('/dashboard')).toBeUndefined()
    expect(spritePageOf('/settings')).toBeUndefined()
    expect(spritePageOf('/')).toBeUndefined()
    expect(spritePageOf('/constructor')).toBeUndefined()
  })
})

describe('Sprite styles kept on the device', () => {
  it('reads each stored page style', () => {
    const styles = parseSpriteStyles('{"teams":"stacked-tiles","statistics":"leading-slot"}')
    expect(spriteStyleOf(styles, 'teams')).toBe('stacked-tiles')
    expect(spriteStyleOf(styles, 'statistics')).toBe('leading-slot')
  })

  it('shows Inline on a page with no stored style', () => {
    expect(spriteStyleOf(parseSpriteStyles('{"teams":"stacked-tiles"}'), 'opponents')).toBe(
      'inline',
    )
  })

  it('shows Inline on a page that shows no Sprites', () => {
    expect(spriteStyleOf(parseSpriteStyles('{"teams":"stacked-tiles"}'), undefined)).toBe('inline')
  })

  it('falls back to Inline when storage is empty or unreadable', () => {
    for (const stored of [null, '', 'not json', '[]', 'null', '"teams"', '42'])
      expect(spriteStyleOf(parseSpriteStyles(stored), 'teams')).toBe('inline')
  })

  it('drops unknown pages and unknown styles', () => {
    expect(
      parseSpriteStyles('{"teams":"huge","dashboard":"inline","opponents":"leading-slot"}'),
    ).toEqual({ opponents: 'leading-slot' })
  })
})
