import type { OpponentView } from '@myvgc/core/schema'

/** The most Opponents the API sends in one page. */
const pageSize = 1000

/**
 * Every one of the User's Opponents, in the API's order. The API sends at most a page at a time,
 * so this asks for pages until one comes back short, and the Opponents list can search everyone.
 */
export async function fetchEveryOpponent(limit = pageSize): Promise<OpponentView[]> {
  const opponents: OpponentView[] = []
  for (;;) {
    const page = await $fetch<OpponentView[]>('/api/opponents', {
      query: { limit, offset: opponents.length },
    })
    opponents.push(...page)
    if (page.length < limit) return opponents
  }
}
