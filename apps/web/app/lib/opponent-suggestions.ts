import type { OpponentView } from '@myvgc/core/schema'
import { searchOpponents } from '@myvgc/core/search'

/** How many Opponents the Round form's picker suggests. */
export const SUGGESTIONS = 8

/** How long the picker waits for the server before it searches the cache instead. */
const serverWait = 4000

/**
 * The Opponents to suggest for `query`, at most `limit`. Online, the server searches (ADR 17).
 * When the request fails or times out, the Opponents list cached on the device is searched the
 * way the Opponents list searches it; with nothing cached, no one is suggested. The failed
 * request decides, not `navigator.onLine`: venue Wi-Fi with no internet counts as online.
 */
export async function suggestOpponents(
  query: string,
  limit: number,
  cached: () => OpponentView[] | undefined,
): Promise<OpponentView[]> {
  const q = query.trim()
  try {
    return await $fetch<OpponentView[]>('/api/opponents', {
      query: { q: q || undefined, limit },
      timeout: serverWait,
    })
  } catch {
    return searchOpponents(cached() ?? [], q).slice(0, limit)
  }
}

/** One choice in the picker: an Opponent, or adding what was typed as a new one. */
export type OpponentOption = { kind: 'existing'; opponent: OpponentView } | { kind: 'new' }

/**
 * What the picker offers for the `typed` text: up to {@link SUGGESTIONS} of the matches, leaving
 * out `exclude`, then adding a new Opponent, unless one already has exactly that display name.
 */
export function opponentOptions(
  matches: OpponentView[],
  typed: string,
  { exclude, allowNew = true }: { exclude?: string; allowNew?: boolean },
): OpponentOption[] {
  const name = typed.trim().toLowerCase()
  const canCreate =
    allowNew && name.length > 0 && !matches.some((o) => o.displayName.toLowerCase() === name)
  return [
    ...matches
      .filter((o) => o.id !== exclude)
      .slice(0, SUGGESTIONS)
      .map((opponent) => ({ kind: 'existing' as const, opponent })),
    ...(canCreate ? [{ kind: 'new' as const }] : []),
  ]
}
