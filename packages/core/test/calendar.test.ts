import { describe, expect, it } from 'vitest'
import { currentRegulation, regulationOn, seasonOf } from '../src/schema'

describe('regulationOn', () => {
  it.each([
    ['2026-04-08', 'M-A'],
    ['2026-06-16', 'M-A'],
    ['2026-06-17', 'M-B'],
    ['2026-08-29', 'M-B'],
    ['2026-09-08', 'M-B'],
    ['2026-09-09', 'M-C'],
    ['2026-12-01', 'M-C'],
  ])('%s is in Reg %s', (date, regulation) => {
    expect(regulationOn(date)).toBe(regulation)
  })

  it('gives the latest Regulation for dates after every known end date', () => {
    expect(regulationOn('2027-03-01')).toBe('M-C')
  })

  it('gives the first Regulation for dates before Champions came out', () => {
    expect(regulationOn('2026-01-15')).toBe('M-A')
  })
})

describe('currentRegulation', () => {
  it('is the Regulation in force on the given day', () => {
    expect(currentRegulation('2026-11-04')).toBe('M-C')
    expect(currentRegulation('2026-07-01')).toBe('M-B')
  })
})

describe('seasonOf', () => {
  it('puts Worlds 2026 in the 2026 Season, which only covers Champions', () => {
    expect(seasonOf('2026-08-30')).toMatchObject({ id: '2026', name: '2026 Season', partial: true })
    expect(seasonOf('2026-04-08')?.id).toBe('2026')
  })

  it('starts the 2027 Season the day after Worlds 2026 and leaves it open-ended', () => {
    expect(seasonOf('2026-08-31')).toMatchObject({ id: '2027', partial: false })
    expect(seasonOf('2027-06-01')?.id).toBe('2027')
  })

  it('has no Season before Champions came out', () => {
    expect(seasonOf('2026-04-07')).toBeUndefined()
  })
})
