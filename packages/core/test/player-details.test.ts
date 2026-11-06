import { describe, expect, it } from 'vitest'
import { MAX_PLAYER_DETAIL_LENGTH, playerDetailsSchema } from '../src/schema'

const fieldsWithErrors = (result: {
  success: boolean
  error?: { issues: { path: PropertyKey[] }[] }
}) => result.error?.issues.map((issue) => issue.path.join('.')) ?? []

describe('Player details', () => {
  it('are all optional, so nothing at all is blank Player details', () => {
    expect(playerDetailsSchema.parse({})).toEqual({
      playerName: '',
      trainerName: '',
      switchProfileName: '',
      playerId: '',
      supportId: '',
      ageDivision: null,
    })
  })

  it('trims their text', () => {
    expect(
      playerDetailsSchema.parse({
        playerName: '  Ash Ketchum ',
        trainerName: 'ASH\n',
        switchProfileName: ' Ash ',
        playerId: ' 1234567 ',
        supportId: ' ABCD-1234 ',
        ageDivision: 'Masters',
      }),
    ).toEqual({
      playerName: 'Ash Ketchum',
      trainerName: 'ASH',
      switchProfileName: 'Ash',
      playerId: '1234567',
      supportId: 'ABCD-1234',
      ageDivision: 'Masters',
    })
  })

  it('limits the length of their text', () => {
    const long = 'x'.repeat(MAX_PLAYER_DETAIL_LENGTH + 1)
    expect(
      fieldsWithErrors(playerDetailsSchema.safeParse({ playerName: long, supportId: long })),
    ).toEqual(['playerName', 'supportId'])
    expect(
      playerDetailsSchema.safeParse({ playerName: 'x'.repeat(MAX_PLAYER_DETAIL_LENGTH) }).success,
    ).toBe(true)
  })

  it.each(['Junior', 'Senior', 'Masters'])('take the Age Division %s', (ageDivision) => {
    expect(playerDetailsSchema.parse({ ageDivision }).ageDivision).toBe(ageDivision)
  })

  it.each(['masters', 'Adult', ''])('refuse the Age Division %j', (ageDivision) => {
    expect(fieldsWithErrors(playerDetailsSchema.safeParse({ ageDivision }))).toEqual([
      'ageDivision',
    ])
  })

  it('never take a date of birth (ADR 20)', () => {
    expect(playerDetailsSchema.parse({ dateOfBirth: '2010-01-01' })).not.toHaveProperty(
      'dateOfBirth',
    )
  })
})
