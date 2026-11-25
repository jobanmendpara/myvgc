import { describe, expect, it } from 'vitest'
import { itemIconUrl, typeIconUrl, typeName } from '../app/lib/icons'

describe('Item icon files', () => {
  it("serves an item's Item icon from its Showdown ID", () => {
    expect(itemIconUrl('choicescarf')).toBe('/item-icons/choicescarf.webp')
  })
})

describe('Type icon files', () => {
  it("serves a type's Type icon from its Showdown ID", () => {
    expect(typeIconUrl('fire')).toBe('/type-icons/fire.webp')
  })

  it('serves the same file for a type written as Showdown writes it', () => {
    expect(typeIconUrl('Fire')).toBe('/type-icons/fire.webp')
  })
})

describe('Type names', () => {
  it('names a type from its Showdown ID or its display name', () => {
    expect(typeName('fairy')).toBe('Fairy')
    expect(typeName('Fairy')).toBe('Fairy')
  })
})
