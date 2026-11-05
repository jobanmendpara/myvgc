// The names list for pickers: display names for every Champions species, move, item and
// ability, keyed by Showdown ID (ADR 14, ADR 17). This module holds only the shape and the
// search, so the web app can use it through `@myvgc/core/schema`; the list itself is built
// from Showdown's data in `champions.ts` and served by the API.

/** A name the Champions data recognises: its Showdown ID and display name. */
export interface Named {
  id: string
  name: string
}

export const NAME_KINDS = ['species', 'moves', 'items', 'abilities'] as const
export type NameKind = (typeof NAME_KINDS)[number]

/** Display names keyed by Showdown ID. */
export type NamesTable = Record<string, string>

/**
 * The names list. Stat Alignments are not in it: there are only 25, hard-coded in
 * `stat-alignment.ts` instead.
 */
export type ChampionsNames = Record<NameKind, NamesTable>

/** Folds text the way Showdown builds IDs: lower case, letters and digits only. */
function fold(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

const byName = (a: Named, b: Named) => a.name.localeCompare(b.name)

/**
 * The entries whose name or ID matches the query, ignoring case and punctuation. Names that
 * start with the query come first, then names that only contain it, each in name order. An
 * empty query lists everything in name order.
 */
export function searchNames(table: NamesTable, query: string, limit = Infinity): Named[] {
  const needle = fold(query)
  const starts: Named[] = []
  const contains: Named[] = []
  for (const [id, name] of Object.entries(table)) {
    const folded = fold(name)
    if (folded.startsWith(needle) || id.startsWith(needle)) starts.push({ id, name })
    else if (folded.includes(needle) || id.includes(needle)) contains.push({ id, name })
  }
  return [...starts.sort(byName), ...contains.sort(byName)].slice(0, limit)
}
