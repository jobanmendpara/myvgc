import { describe, expect, it } from 'vitest'
import { MAX_PLAYER_DETAIL_LENGTH, playerDetailsSchema, playerDetailsSchemaOn } from '../src/schema'

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
      dateOfBirth: null,
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
      dateOfBirth: null,
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

  it('take a Date of Birth (ADR 26)', () => {
    expect(playerDetailsSchema.parse({ dateOfBirth: '2010-01-31' }).dateOfBirth).toBe('2010-01-31')
    expect(playerDetailsSchema.parse({ dateOfBirth: null }).dateOfBirth).toBeNull()
  })

  it.each(['31/01/2010', '2010-02-30', '2010-1-31', ''])(
    'refuse the Date of Birth %j',
    (dateOfBirth) => {
      expect(fieldsWithErrors(playerDetailsSchema.safeParse({ dateOfBirth }))).toEqual([
        'dateOfBirth',
      ])
    },
  )

  it('refuse a Date of Birth after the day they are saved on', () => {
    const savedOn = playerDetailsSchemaOn('2026-11-09')
    expect(savedOn.parse({ dateOfBirth: '2026-11-09' }).dateOfBirth).toBe('2026-11-09')
    expect(fieldsWithErrors(savedOn.safeParse({ dateOfBirth: '2026-11-10' }))).toEqual([
      'dateOfBirth',
    ])
  })
})
