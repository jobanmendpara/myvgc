import { describe, expect, it } from 'vitest'
import {
  buildCardPageOf,
  itemIconUrl,
  moveLayoutOf,
  parseMoveLayouts,
  parseTypeIconStyles,
  powerAccuracyLabel,
  powerAccuracyText,
  typeIconStyleOf,
  typeIconUrl,
} from '../app/lib/icons'

describe('Pages with Pokémon build cards', () => {
  it('gives Teams, Opponents and Tournaments each their own settings, by the first part of the path', () => {
    expect(buildCardPageOf('/teams/abc/edit')).toBe('teams')
    expect(buildCardPageOf('/opponents')).toBe('opponents')
    expect(buildCardPageOf('/tournaments/x/rounds/y')).toBe('tournaments')
  })

  it('has none on Statistics or pages without build cards', () => {
    for (const path of ['/statistics', '/settings', '/', '/dashboard'])
      expect(buildCardPageOf(path)).toBeUndefined()
  })
})

describe('Type icon styles kept on the device', () => {
  it('reads each stored page style', () => {
    const styles = parseTypeIconStyles('{"teams":"badges","tournaments":"labelled"}')
    expect(typeIconStyleOf(styles, 'teams')).toBe('badges')
    expect(typeIconStyleOf(styles, 'tournaments')).toBe('labelled')
  })

  it('shows Compact on a page with no stored style, or without build cards', () => {
    const styles = parseTypeIconStyles('{"teams":"badges"}')
    expect(typeIconStyleOf(styles, 'opponents')).toBe('compact')
    expect(typeIconStyleOf(styles, undefined)).toBe('compact')
  })

  it('falls back to Compact when storage is empty or unreadable', () => {
    for (const stored of [null, '', 'not json', '[]', 'null', '"teams"', '42'])
      expect(typeIconStyleOf(parseTypeIconStyles(stored), 'teams')).toBe('compact')
  })

  it('drops unknown pages and unknown styles', () => {
    expect(
      parseTypeIconStyles('{"teams":"huge","statistics":"badges","opponents":"labelled"}'),
    ).toEqual({ opponents: 'labelled' })
  })
})

describe('Move layouts kept on the device', () => {
  it('reads each stored page layout', () => {
    expect(moveLayoutOf(parseMoveLayouts('{"opponents":"two-columns"}'), 'opponents')).toBe(
      'two-columns',
    )
  })

  it('shows One column on a page with no stored layout, or without build cards', () => {
    const layouts = parseMoveLayouts('{"teams":"two-columns"}')
    expect(moveLayoutOf(layouts, 'tournaments')).toBe('one-column')
    expect(moveLayoutOf(layouts, undefined)).toBe('one-column')
  })

  it('falls back to One column when storage is empty or unreadable', () => {
    for (const stored of [null, '', 'not json', '[]', 'null', '"teams"', '42'])
      expect(moveLayoutOf(parseMoveLayouts(stored), 'teams')).toBe('one-column')
  })

  it('drops unknown pages and unknown layouts', () => {
    expect(
      parseMoveLayouts('{"teams":"grid","statistics":"two-columns","tournaments":"one-column"}'),
    ).toEqual({
      tournaments: 'one-column',
    })
  })
})

describe('Item icon files', () => {
  it("serves an item's Item icon from its Showdown ID", () => {
    expect(itemIconUrl('choicescarf')).toBe('/item-icons/choicescarf.webp')
  })
})

describe('Type icon files', () => {
  it("serves a type's Type icon from its Showdown ID", () => {
    expect(typeIconUrl('fire')).toBe('/type-icons/fire.webp')
  })
})

describe("A move's power and accuracy", () => {
  it('shows both numbers', () => {
    expect(powerAccuracyText({ power: 120, accuracy: 100 })).toBe('120/100')
    expect(powerAccuracyLabel({ power: 120, accuracy: 100 })).toBe('Power 120, accuracy 100')
  })

  it('shows a dash for a move that never misses', () => {
    expect(powerAccuracyText({ power: 85, accuracy: null })).toBe('85/—')
    expect(powerAccuracyLabel({ power: 85, accuracy: null })).toBe(
      'Power 85, accuracy never misses',
    )
  })

  it('shows a dash for power that varies', () => {
    expect(powerAccuracyText({ power: null, accuracy: 100 })).toBe('—/100')
    expect(powerAccuracyLabel({ power: null, accuracy: 100 })).toBe('Power varies, accuracy 100')
  })
})
