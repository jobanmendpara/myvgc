import { describe, expect, it } from 'vitest'
import { checkDataExport, readDataExport } from '../src'
import { ids, pokemon, versionOne } from './data-export-file'

const noAccount = { opponentIds: new Set<string>() }

/** Reads a file that must parse, then checks it. */
function check(file: unknown, account = noAccount) {
  const read = readDataExport(file)
  if (!read.ok) throw new Error(`should read: ${JSON.stringify(read.issues)}`)
  return checkDataExport(read.file, account)
}

const otherId = '00000000-0000-4000-8000-0000000000ff'

describe('Checking a Data export before it is imported', () => {
  it('finds nothing wrong with a file whose records all hold together', () => {
    expect(check(versionOne())).toEqual([])
  })

  it('refuses species, items and moves the install doesn’t know, in Teams and Team snapshots', () => {
    const file = versionOne()
    file.teams[0]!.pokemon = [{ ...pokemon[0]!, item: 'notanitem' }]
    file.tournaments[0]!.team!.pokemon = [{ ...pokemon[0]!, species: 'agumon' }]
    expect(check(file)).toEqual([
      expect.objectContaining({ path: ['teams', 0, 'pokemon', 0, 'item'], record: 'Team “Rain”' }),
      expect.objectContaining({
        path: ['tournaments', 0, 'team', 'pokemon', 0, 'species'],
        record: 'Tournament “Worlds”',
      }),
    ])
  })

  it('refuses a Game with a species the install doesn’t know', () => {
    const file = versionOne()
    file.tournaments[0]!.rounds[0]!.games = [{ number: 1, brought: ['agumon'] }] as never
    expect(check(file)).toEqual([
      expect.objectContaining({
        path: ['tournaments', 0, 'rounds', 0, 'games', 0, 'brought', 0],
        record: 'Tournament “Worlds”, Round 1',
      }),
    ])
  })

  it('applies the rules a Round is saved with', () => {
    const file = versionOne()
    Object.assign(file.tournaments[0]!.rounds[0]!, { gameScore: { won: 2, lost: 2 } })
    expect(check(file)).toEqual([
      expect.objectContaining({ path: ['tournaments', 0, 'rounds', 0, 'gameScore'] }),
    ])
  })

  it('refuses two Rounds in one Tournament with the same Swiss round number or Top cut stage', () => {
    const file = versionOne()
    const [first] = file.tournaments[0]!.rounds
    const top8 = {
      ...first!,
      phase: 'top-cut',
      roundNumber: null,
      stage: 'top-8',
    } as never as typeof first & {}
    file.tournaments[0]!.rounds.push(
      { ...first!, id: '00000000-0000-4000-8000-000000000010' },
      { ...top8, id: '00000000-0000-4000-8000-000000000011' },
      { ...top8, id: '00000000-0000-4000-8000-000000000012' },
    )
    expect(check(file).map((issue) => [issue.record, issue.message])).toEqual([
      ['Tournament “Worlds”, Round 1', 'Round 1 is listed twice in this Tournament.'],
      ['Tournament “Worlds”, Top 8', 'Top 8 is listed twice in this Tournament.'],
    ])
  })

  it('refuses a Round against an Opponent in neither the file nor the account', () => {
    const file = versionOne()
    file.opponents = []
    expect(check(file)).toEqual([
      expect.objectContaining({
        path: ['tournaments', 0, 'rounds', 0, 'opponentId'],
        message: 'Its Opponent isn’t in the file or in your account.',
      }),
    ])
    expect(check(file, { opponentIds: new Set([ids.opponent]) })).toEqual([])
  })

  it('lets a Team snapshot point at a Team that is gone, since it keeps its own copy', () => {
    const file = versionOne()
    file.tournaments[0]!.team!.teamId = otherId
    expect(check(file)).toEqual([])
  })

  it('refuses the same id twice for one kind of record', () => {
    const file = versionOne()
    file.teams.push({ ...file.teams[0]!, name: 'Sun' })
    expect(check(file)).toEqual([
      expect.objectContaining({
        path: ['teams', 1, 'id'],
        record: 'Team “Sun”',
        message: 'This id is used twice in the file.',
      }),
    ])
  })
})
