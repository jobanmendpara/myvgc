import { describe, expect, it } from 'vitest'
import { DATA_EXPORT_VERSION, readDataExport } from '../src/schema'
import { current, ids, versionOne } from './data-export-file'

describe('Reading a Data export', () => {
  it('reads a file in the current version', () => {
    const read = readDataExport(current())
    expect(read).toMatchObject({ ok: true })
    if (!read.ok) return
    expect(read.file.version).toBe(DATA_EXPORT_VERSION)
    expect(read.file.tournaments[0]!.rounds[0]!.opponentId).toBe(ids.opponent)
    expect(read.file.opponents[0]!.noteEntries).toHaveLength(1)
    expect(read.file.tournaments[0]!.opponentTeams[0]!.opponentId).toBe(ids.opponent)
  })

  it('upgrades a version 1 file, whose Tournaments have no Opponent’s Teams', () => {
    const read = readDataExport(versionOne())
    if (!read.ok) throw new Error('should read')
    expect(read.file.version).toBe(DATA_EXPORT_VERSION)
    expect(read.file.tournaments[0]!.opponentTeams).toEqual([])
  })

  it('refuses a file from a newer version, asking to update the install', () => {
    const read = readDataExport({ ...versionOne(), version: DATA_EXPORT_VERSION + 1 })
    expect(read).toMatchObject({ ok: false })
    if (read.ok) return
    expect(read.issues[0]!.message).toMatch(/newer version of MyVGC.*Update/)
  })

  it.each([
    ['another format', { format: 'something-else' }],
    ['no version', { version: undefined }],
    ['version 0', { version: 0 }],
    ['a version that is not a whole number', { version: 1.5 }],
  ])('refuses a file with %s', (_, header) => {
    const read = readDataExport({ ...versionOne(), ...header })
    expect(read.ok).toBe(false)
  })

  it.each([null, 'not json', [], 42])('refuses %j as not a Data export', (input) => {
    expect(readDataExport(input).ok).toBe(false)
  })

  it('names the record a broken field belongs to', () => {
    const file = versionOne()
    file.tournaments[0]!.rounds[0]!.result = 'draw'
    const read = readDataExport(file)
    expect(read).toMatchObject({ ok: false })
    if (read.ok) return
    expect(read.issues[0]).toMatchObject({
      path: ['tournaments', 0, 'rounds', 0, 'result'],
      record: 'Tournament “Worlds”, Round 1',
    })
  })

  it('names Teams, Opponents and their Note entries by what the User calls them', () => {
    const file = versionOne()
    file.teams[0]!.name = ''
    file.opponents[0]!.noteEntries[0]!.text = ''
    const read = readDataExport(file)
    if (read.ok) throw new Error('should not read')
    expect(read.issues.map((issue) => issue.record)).toEqual([
      'Team 1',
      'Opponent “Wolfe”, Note entry of 2026-09-19',
    ])
  })

  it('keeps every id and timestamp', () => {
    const read = readDataExport(current())
    if (!read.ok) throw new Error('should read')
    expect(read.file).toEqual(current())
  })
})
