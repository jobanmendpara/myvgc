import { z } from 'zod'
import { REGULATIONS, type Regulation } from './team'

export const LIST_STYLES = ['compact', 'detailed', 'grouped'] as const
export type ListStyle = (typeof LIST_STYLES)[number]

/** What a User who has never chosen sees: close to the lists before List styles existed. */
export const DEFAULT_LIST_STYLES = {
  tournaments: 'detailed',
  teams: 'detailed',
  opponents: 'compact',
} as const satisfies Record<string, ListStyle>

const style = (fallback: ListStyle) =>
  z.enum(LIST_STYLES, 'Choose Compact, Detailed or Grouped.').default(fallback)

/**
 * A User's List style for each of the three lists (see CONTEXT.md), an Account setting. A list
 * left out gets its default.
 */
export const listStylesSchema = z.object({
  tournaments: style(DEFAULT_LIST_STYLES.tournaments),
  teams: style(DEFAULT_LIST_STYLES.teams),
  opponents: style(DEFAULT_LIST_STYLES.opponents),
})

export type ListStyles = z.output<typeof listStylesSchema>

/** A heading in the Grouped List style and the items under it. */
export type ListGroup<T> = { label: string; items: T[] }

// Groups items under `labelOf`, with the groups in the order of `labels`; an item keeps its
// place in the list within its group. A label with no items makes no group.
function groupBy<T>(items: readonly T[], labelOf: (item: T) => string, labels: string[]) {
  const groups = new Map<string, T[]>(labels.map((label) => [label, []]))
  for (const item of items) groups.get(labelOf(item))?.push(item)
  return [...groups]
    .filter(([, members]) => members.length)
    .map(([label, members]) => ({ label, items: members }))
}

/** Tournaments in the Grouped List style: upcoming ones first, then by year, newest first. */
export function groupTournaments<T extends { upcoming: boolean; startDate: string }>(
  tournaments: readonly T[],
): ListGroup<T>[] {
  const labelOf = (t: T) => (t.upcoming ? 'Upcoming' : t.startDate.slice(0, 4))
  const years = [...new Set(tournaments.filter((t) => !t.upcoming).map(labelOf))].sort().reverse()
  return groupBy(tournaments, labelOf, ['Upcoming', ...years])
}

/** Teams in the Grouped List style: by Regulation, newest first. */
export function groupTeams<T extends { regulation: Regulation }>(
  teams: readonly T[],
): ListGroup<T>[] {
  const labelOf = (regulation: Regulation) => `Regulation ${regulation}`
  const labels = [...REGULATIONS].reverse().map(labelOf)
  return groupBy(teams, (team) => labelOf(team.regulation), labels)
}

const OTHER = '#'
const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
// "Éric" files under E; a name starting with anything but a letter files under #.
function initialOf(name: string) {
  const letter = name.normalize('NFD').charAt(0).toUpperCase()
  return LETTERS.includes(letter) ? letter : OTHER
}

/** Opponents in the Grouped List style: A–Z by display name, then any not starting with a letter. */
export function groupOpponents<T extends { displayName: string }>(
  opponents: readonly T[],
): ListGroup<T>[] {
  const sorted = [...opponents].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, 'en', { sensitivity: 'base' }),
  )
  return groupBy(sorted, (o) => initialOf(o.displayName), [...LETTERS, OTHER])
}
