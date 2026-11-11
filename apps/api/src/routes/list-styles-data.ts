import { DEFAULT_LIST_STYLES, type ListStyles } from '@myvgc/core'
import { eq } from 'drizzle-orm'
import { listStyles } from '../db/schema'
import type { Database } from '../db/types'

type ListStylesRow = typeof listStyles.$inferSelect

/** A User's List styles; the defaults when they have never chosen any. */
function toListStylesView(row?: ListStylesRow): ListStyles {
  if (!row) return { ...DEFAULT_LIST_STYLES }
  return { tournaments: row.tournaments, teams: row.teams, opponents: row.opponents }
}

export async function loadListStyles(db: Pick<Database, 'select'>, userId: string) {
  const [row] = await db.select().from(listStyles).where(eq(listStyles.userId, userId))
  return toListStylesView(row)
}

/** Replaces all of a User's List styles, making their row on the first save. */
export async function saveListStyles(
  db: Pick<Database, 'insert'>,
  userId: string,
  styles: ListStyles,
) {
  const [row] = await db
    .insert(listStyles)
    .values({ userId, ...styles })
    .onConflictDoUpdate({ target: listStyles.userId, set: styles })
    .returning()
  return toListStylesView(row)
}
