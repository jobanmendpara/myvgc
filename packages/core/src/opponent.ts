import { z } from 'zod'
import { clientIdSchema } from './client-id'
import type { NoteEntryView } from './note-entry'
import { MAX_OPPONENT_NAME_LENGTH, type RoundView, type Tally } from './round'
import { MAX_NOTES_LENGTH } from './team'

export const MAX_ALIASES = 20

const name = (what: string) =>
  z
    .string()
    .trim()
    .min(1, `Give the ${what} a name.`)
    .max(MAX_OPPONENT_NAME_LENGTH, `Names can be at most ${MAX_OPPONENT_NAME_LENGTH} characters.`)

const opponentFields = {
  displayName: name('Opponent'),
  aliases: z
    .array(name('Alias'))
    .max(MAX_ALIASES, `An Opponent can have at most ${MAX_ALIASES} Aliases.`)
    // The same name twice, in any case, adds nothing: the first spelling is kept.
    .transform((aliases) => {
      const seen = new Set<string>()
      return aliases.filter((alias) => {
        const key = alias.toLowerCase()
        return !seen.has(key) && Boolean(seen.add(key))
      })
    }),
  notes: z.string().max(MAX_NOTES_LENGTH, `Notes can be at most ${MAX_NOTES_LENGTH} characters.`),
}

/** What a User sends to add an Opponent. */
export const newOpponentSchema = z.object({
  id: clientIdSchema,
  ...opponentFields,
  aliases: opponentFields.aliases.default([]),
  notes: opponentFields.notes.default(''),
})

/** What a User sends to change an Opponent. Aliases, when sent, replace the whole list. */
export const opponentChangesSchema = z.object(opponentFields).partial()

export type NewOpponent = z.input<typeof newOpponentSchema>

/** An Opponent as the API lists it. */
export interface OpponentView {
  id: string
  displayName: string
  aliases: string[]
  notes: string
  /** The User's results against them. Byes never count, as they have no Opponent. */
  headToHead: Tally
  roundCount: number
  createdAt: string
  updatedAt: string
}

/** A Round against an Opponent, with the Tournament it was in. */
export type OpponentRoundView = RoundView & {
  tournament: { id: string; name: string; startDate: string }
}

/** An Opponent with every Round against them and their Note entries, each newest first. */
export interface OpponentDetailView extends OpponentView {
  rounds: OpponentRoundView[]
  noteEntries: NoteEntryView[]
}

/** What a merge combines from each Opponent. */
export interface MergeableOpponent {
  displayName: string
  aliases: string[]
  notes: string
}

type MergeIssue = { path: [string]; message: string }

/** The survivor's Aliases and notes after a merge, or why it can't be merged. */
export type MergedOpponent =
  | { ok: true; aliases: string[]; notes: string }
  | { ok: false; issues: [MergeIssue, ...MergeIssue[]] }

/**
 * Combines a duplicate Opponent into the survivor. The survivor keeps its display name; the
 * duplicate's name joins its Aliases, and the duplicate's notes follow the survivor's.
 */
export function mergeOpponents(
  survivor: MergeableOpponent,
  duplicate: MergeableOpponent,
): MergedOpponent {
  // Compared in any case; the first spelling is kept, and the survivor's comes first.
  const seen = new Set([survivor.displayName.toLowerCase()])
  const aliases = [...survivor.aliases, duplicate.displayName, ...duplicate.aliases].filter(
    (alias) => {
      const key = alias.toLowerCase()
      return !seen.has(key) && Boolean(seen.add(key))
    },
  )
  const notes = [
    survivor.notes,
    duplicate.notes && `**From ${duplicate.displayName}:**\n\n${duplicate.notes}`,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n')

  const issues: MergeIssue[] = []
  if (aliases.length > MAX_ALIASES)
    issues.push({
      path: ['aliases'],
      message: `Together they’d have ${aliases.length} Aliases, and an Opponent can have at most ${MAX_ALIASES}. Remove ${aliases.length - MAX_ALIASES} first.`,
    })
  if (notes.length > MAX_NOTES_LENGTH)
    issues.push({
      path: ['notes'],
      message: `Together their notes would be ${notes.length} characters, and notes can be at most ${MAX_NOTES_LENGTH}. Shorten them first.`,
    })
  const [first, ...rest] = issues
  return first ? { ok: false, issues: [first, ...rest] } : { ok: true, aliases, notes }
}

/** What a User sends to merge a duplicate Opponent into the one in the URL. */
export const mergeOpponentSchema = z.object({
  duplicateId: z.uuid('Choose the duplicate Opponent.'),
})
