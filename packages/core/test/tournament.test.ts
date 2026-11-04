import { describe, expect, it } from 'vitest'
import { formatMoney, fromMinorUnits, newTournamentSchema, toMinorUnits } from '../src/schema'

describe('Entry fee amounts', () => {
  it.each([
    ['35', 'USD', 3500],
    ['35.5', 'USD', 3550],
    ['35,50', 'EUR', 3550],
    ['0', 'CAD', 0],
    ['3000', 'JPY', 3000],
  ])('reads %s %s as %i minor units', (text, currency, amount) => {
    expect(toMinorUnits(text, currency)).toBe(amount)
  })

  it.each([
    ['', 'USD'],
    ['-5', 'USD'],
    ['3.505', 'USD'],
    ['30.5', 'JPY'],
    ['ten', 'USD'],
  ])('refuses %j in %s', (text, currency) => {
    expect(toMinorUnits(text, currency)).toBeUndefined()
  })

  it('writes amounts back the way they are typed and shown', () => {
    expect(fromMinorUnits(3550, 'USD')).toBe('35.50')
    expect(fromMinorUnits(3000, 'JPY')).toBe('3000')
    expect(formatMoney({ amount: 3550, currency: 'USD' })).toBe('$35.50')
    expect(formatMoney({ amount: 3000, currency: 'JPY' })).toBe('¥3,000')
  })
})

describe('Entry fee currency', () => {
  const withFee = (currency: string) =>
    newTournamentSchema.safeParse({
      name: 'Locals',
      startDate: '2026-10-01',
      eventTier: 'grassroots',
      entryFee: { amount: 1000, currency },
    }).success

  it('accepts real currencies and refuses made-up codes', () => {
    expect(withFee('CAD')).toBe(true)
    expect(withFee('JPY')).toBe(true)
    expect(withFee('ABC')).toBe(false)
  })
})
