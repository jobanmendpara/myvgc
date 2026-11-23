import type { OpponentView } from '@myvgc/core/schema'
import { FetchError } from 'ofetch'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { opponentOptions, suggestOpponents } from '../app/lib/opponent-suggestions'

const opponent = (id: string, displayName: string, aliases: string[] = []) =>
  ({ id, displayName, aliases }) as OpponentView

const names = (opponents: OpponentView[]) => opponents.map((o) => o.displayName)

/** Stands in for GET /api/opponents?q=, answering with these Opponents. */
function serverAnswers(opponents: OpponentView[]) {
  const asked: unknown[] = []
  vi.stubGlobal('$fetch', async (url: string, options: { query: unknown }) => {
    expect(url).toBe('/api/opponents')
    asked.push(options.query)
    return opponents
  })
  return asked
}

/** Stands in for a server that can't be reached, as ofetch reports it. */
function serverUnreachable() {
  vi.stubGlobal('$fetch', async () => {
    throw new FetchError('[GET] "/api/opponents": <no response> fetch failed')
  })
}

const cachedList = [
  opponent('1', 'Aaron Zheng', ['Cybertron']),
  opponent('2', 'Wolfe Glick', ['Wolfey']),
  opponent('3', 'Ray Rizzo'),
]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Suggesting Opponents in the Round form', () => {
  it('asks the server when it can be reached', async () => {
    const asked = serverAnswers([opponent('9', 'From the server')])
    const found = await suggestOpponents('serv', 8, () => cachedList)
    expect(names(found)).toEqual(['From the server'])
    expect(asked).toEqual([{ q: 'serv', limit: 8 }])
  })

  it('searches the cached Opponents list by display name when the server can’t be reached', async () => {
    serverUnreachable()
    expect(names(await suggestOpponents('wolfe', 8, () => cachedList))).toEqual(['Wolfe Glick'])
  })

  it('searches the cached Opponents list by Alias, forgiving a typo', async () => {
    serverUnreachable()
    expect(names(await suggestOpponents('cybertorn', 8, () => cachedList))).toEqual(['Aaron Zheng'])
  })

  it('shows at most as many cached Opponents as the server would', async () => {
    serverUnreachable()
    const many = Array.from({ length: 20 }, (_, i) => opponent(`${i}`, `Player ${i}`))
    expect(await suggestOpponents('', 8, () => many)).toHaveLength(8)
    expect(await suggestOpponents('player', 9, () => many)).toHaveLength(9)
  })

  it('suggests no one when the server can’t be reached and nothing is cached', async () => {
    serverUnreachable()
    expect(await suggestOpponents('wolfe', 8, () => undefined)).toEqual([])
  })

  it('gives up on a server that takes too long and searches the cache', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('$fetch', (_url: string, options: { timeout?: number }) => {
      // ofetch aborts the request after `timeout` milliseconds.
      return new Promise((_resolve, reject) =>
        setTimeout(() => reject(new FetchError('aborted')), options.timeout ?? Infinity),
      )
    })
    const found = suggestOpponents('ray', 8, () => cachedList)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(names(await found)).toEqual(['Ray Rizzo'])
    vi.useRealTimers()
  })
})

describe('The Opponent picker’s options', () => {
  const matches = [opponent('1', 'Aaron Zheng', ['Cybertron']), opponent('2', 'Aaron Traylor')]

  it('lists the matches, then offers to add what was typed as a new Opponent', () => {
    expect(opponentOptions(matches, 'Aaron', {})).toEqual([
      { kind: 'existing', opponent: matches[0] },
      { kind: 'existing', opponent: matches[1] },
      { kind: 'new' },
    ])
  })

  it('offers the Opponent with exactly that display name instead of a new one', () => {
    expect(opponentOptions(matches, 'aaron zheng', {}).map((o) => o.kind)).toEqual([
      'existing',
      'existing',
    ])
  })

  it('offers only to add a new Opponent when nothing matches', () => {
    expect(opponentOptions([], 'Someone New', {})).toEqual([{ kind: 'new' }])
  })

  it('offers nothing new before anything is typed, or when adding is off', () => {
    expect(opponentOptions([], '  ', {})).toEqual([])
    expect(opponentOptions([], 'Someone New', { allowNew: false })).toEqual([])
  })

  it('leaves out the excluded Opponent and shows at most 8', () => {
    const many = Array.from({ length: 9 }, (_, i) => opponent(`${i}`, `Player ${i}`))
    const options = opponentOptions(many, 'Player', { exclude: '0' })
    expect(options.filter((o) => o.kind === 'existing')).toHaveLength(8)
    expect(options.some((o) => o.kind === 'existing' && o.opponent.id === '0')).toBe(false)
  })
})
