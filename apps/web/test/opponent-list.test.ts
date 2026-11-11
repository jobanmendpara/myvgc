import type { OpponentView } from '@myvgc/core/schema'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchEveryOpponent } from '../app/lib/opponent-list'

interface PageQuery {
  limit: number
  offset: number
}

/**
 * Stands in for the API's GET /api/opponents over this many Opponents, by stubbing Nuxt's global
 * `$fetch`. Returns the pages asked for, in order.
 */
function serveOpponents(count: number): PageQuery[] {
  const opponents = Array.from(
    { length: count },
    (_, i) => ({ id: `opponent-${i}` }) as OpponentView,
  )
  const asked: PageQuery[] = []
  vi.stubGlobal('$fetch', async (url: string, options: { query: PageQuery }) => {
    expect(url).toBe('/api/opponents')
    const { limit, offset } = options.query
    asked.push({ limit, offset })
    return opponents.slice(offset, offset + limit)
  })
  return asked
}

const ids = (opponents: OpponentView[]) => opponents.map((opponent) => opponent.id)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Fetching every Opponent', () => {
  it('joins pages, in order, until one comes back short', async () => {
    const asked = serveOpponents(7)
    const opponents = await fetchEveryOpponent(3)
    expect(ids(opponents)).toEqual([0, 1, 2, 3, 4, 5, 6].map((i) => `opponent-${i}`))
    expect(asked).toEqual([
      { limit: 3, offset: 0 },
      { limit: 3, offset: 3 },
      { limit: 3, offset: 6 },
    ])
  })

  it('asks once more when the last page is full, and stops on the empty one', async () => {
    const asked = serveOpponents(6)
    const opponents = await fetchEveryOpponent(3)
    expect(opponents).toHaveLength(6)
    expect(asked.map((page) => page.offset)).toEqual([0, 3, 6])
  })

  it('stops on an empty first page', async () => {
    const asked = serveOpponents(0)
    expect(await fetchEveryOpponent(3)).toEqual([])
    expect(asked).toEqual([{ limit: 3, offset: 0 }])
  })

  it('asks for pages of 1000, the most the API sends', async () => {
    const asked = serveOpponents(1500)
    expect(await fetchEveryOpponent()).toHaveLength(1500)
    expect(asked).toEqual([
      { limit: 1000, offset: 0 },
      { limit: 1000, offset: 1000 },
    ])
  })
})
