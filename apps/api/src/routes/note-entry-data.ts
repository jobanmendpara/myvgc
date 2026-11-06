import type { NoteEntryView } from '@myvgc/core'
import { desc, eq } from 'drizzle-orm'
import { opponentNoteEntry } from '../db/schema'
import type { Database } from '../db/types'

export type NoteEntryRow = typeof opponentNoteEntry.$inferSelect

export function toNoteEntryView(row: NoteEntryRow): NoteEntryView {
  return {
    id: row.id,
    date: row.date,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** An Opponent's Note entries, newest date first, and the later-added first on the same date. */
export async function loadNoteEntries(db: Database, opponentId: string) {
  const rows = await db
    .select()
    .from(opponentNoteEntry)
    .where(eq(opponentNoteEntry.opponentId, opponentId))
    .orderBy(desc(opponentNoteEntry.date), desc(opponentNoteEntry.createdAt))
  return rows.map(toNoteEntryView)
}
