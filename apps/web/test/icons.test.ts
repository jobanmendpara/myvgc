import { describe, expect, it } from 'vitest'
import { itemIconUrl, powerAccuracyLabel, powerAccuracyText, typeIconUrl } from '../app/lib/icons'

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
