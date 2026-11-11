import type { RoundView } from '@myvgc/core/schema'
import { describe, expect, it } from 'vitest'
import { formatDates, ordinal, percent, roundLabel, roundOutcome } from '../app/lib/format'

/** A Swiss Round won 1-0, with these fields changed. */
function round(changes: Partial<RoundView> = {}): RoundView {
  return {
    id: 'round',
    tournamentId: 'tournament',
    phase: 'swiss',
    roundNumber: 1,
    stage: null,
    bestOf: 1,
    bye: false,
    result: 'win',
    gameScore: null,
    opponent: null,
    notes: '',
    games: [],
    createdAt: '2026-11-11T00:00:00.000Z',
    updatedAt: '2026-11-11T00:00:00.000Z',
    ...changes,
  }
}

describe("A Round's place and result", () => {
  it('names a Swiss Round by its number and a Top Cut Round by its stage', () => {
    expect(roundLabel(round({ roundNumber: 3 }))).toBe('Round 3')
    expect(roundLabel(round({ phase: 'top-cut', roundNumber: null, stage: 'top-8' }))).toBe('Top 8')
  })

  it('gives the result, with the Game score when there is one', () => {
    expect(roundOutcome(round({ result: 'loss' }))).toBe('Loss')
    expect(roundOutcome(round({ bestOf: 3, gameScore: { won: 2, lost: 1 } }))).toBe('Win 2-1')
  })
})

describe("A Tournament's dates", () => {
  it('gives one day in full', () => {
    expect(formatDates('2026-09-19')).toBe('19 Sept 2026')
    expect(formatDates('2026-09-19', null)).toBe('19 Sept 2026')
    expect(formatDates('2026-09-19', '2026-09-19')).toBe('19 Sept 2026')
  })

  it('gives the year once for days in the same year, and twice across a new year', () => {
    expect(formatDates('2026-09-19', '2026-09-20')).toBe('19 Sept – 20 Sept 2026')
    expect(formatDates('2026-12-31', '2027-01-01')).toBe('31 Dec 2026 – 1 Jan 2027')
  })
})

describe('Placements and rates', () => {
  it('writes ordinals, including the teens', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111, 112].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '101st',
      '111th',
      '112th',
    ])
  })

  it('rounds a rate to a whole percentage, or shows a dash when there is none', () => {
    expect(percent(2 / 3)).toBe('67%')
    expect(percent(0)).toBe('0%')
    expect(percent(null)).toBe('—')
  })
})
