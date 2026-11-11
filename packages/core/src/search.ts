import uFuzzy from '@leeoniya/ufuzzy'

// Searching the Tournaments, Teams and Opponents lists in the browser (DEV-82). Kept apart from
// `./schema` so the web app can import it as `@myvgc/core/search` without Showdown's data.

// One error per word: a swapped, wrong, missing or extra letter, so "Jhon" finds "John".
const fuzzy = new uFuzzy({ intraMode: 1 })

// "Éric" and "eric" are the same to a search.
const fold = (text: string) => uFuzzy.latinize(text.trim().toLowerCase())

// 0: a field is the query; 1: a field starts with it; 2: a word in a field does; 3: fuzzy.
function tierOf(fields: string[], query: string) {
  if (fields.some((field) => field === query)) return 0
  if (fields.some((field) => field.startsWith(query))) return 1
  if (fields.some((field) => field.split(/\s+/).some((word) => word.startsWith(query)))) return 2
  return 3
}

/**
 * The items matching `query` in any of their fields, best match first. Within a tier, uFuzzy's
 * ranking decides. An empty query returns every item in its usual order.
 */
function search<T>(items: readonly T[], query: string, fieldsOf: (item: T) => string[]): T[] {
  const needle = fold(query)
  if (!needle) return [...items]
  const fields = items.map((item) => fieldsOf(item).filter(Boolean).map(fold))
  const haystack = fields.map((f) => f.join(' · '))
  // Up to three words may come in any order ("zheng aaron"); a longer query keeps its order and
  // comes back unranked. Every match is ranked, however many there are.
  const [idxs, info, order] = fuzzy.search(haystack, needle, 3, Infinity)
  const ranked = info && order ? order.map((i) => info.idx[i]!) : (idxs ?? [])
  return ranked
    .map((i, rank) => ({ i, rank, tier: tierOf(fields[i]!, needle) }))
    .sort((a, b) => a.tier - b.tier || a.rank - b.rank)
    .map(({ i }) => items[i]!)
}

/** Tournaments matching `query` by name, Organizer or location. */
export function searchTournaments<
  T extends { name: string; organizer: string | null; location: string | null },
>(tournaments: readonly T[], query: string): T[] {
  return search(tournaments, query, (t) => [t.name, t.organizer ?? '', t.location ?? ''])
}

/** Teams matching `query` by name or by the species of a Pokémon build. */
export function searchTeams<T extends { name: string; pokemon: { names: { species: string } }[] }>(
  teams: readonly T[],
  query: string,
): T[] {
  return search(teams, query, (team) => [team.name, ...team.pokemon.map((p) => p.names.species)])
}

/** Opponents matching `query` by display name or Alias. */
export function searchOpponents<T extends { displayName: string; aliases: string[] }>(
  opponents: readonly T[],
  query: string,
): T[] {
  return search(opponents, query, (o) => [o.displayName, ...o.aliases])
}
