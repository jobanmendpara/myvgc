import { z } from 'zod'
import { clientIdSchema } from './client-id'
import { MAX_NOTES_LENGTH } from './team'

const noteEntryFields = {
  date: z.iso.date('Use a date such as 2026-09-19.'),
  text: z
    .string()
    .trim()
    .min(1, 'Write something in the note.')
    .max(MAX_NOTES_LENGTH, `Notes can be at most ${MAX_NOTES_LENGTH} characters.`),
}

/** What a User sends to add a Note entry to an Opponent. */
export const newNoteEntrySchema = z.object({ id: clientIdSchema, ...noteEntryFields })

/** What a User sends to change a Note entry. */
export const noteEntryChangesSchema = z.object(noteEntryFields).partial()

export type NewNoteEntry = z.input<typeof newNoteEntrySchema>

/** A Note entry as the API shows it. */
export interface NoteEntryView {
  id: string
  /** A calendar date, such as 2026-09-19. */
  date: string
  text: string
  createdAt: string
  updatedAt: string
}
