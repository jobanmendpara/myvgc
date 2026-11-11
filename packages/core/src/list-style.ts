import { z } from 'zod'

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
