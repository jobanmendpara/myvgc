import { z } from 'zod'
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
    // The same name twice, or the display name again, adds nothing.
    .transform((aliases) => [...new Map(aliases.map((a) => [a.toLowerCase(), a])).values()]),
  notes: z.string().max(MAX_NOTES_LENGTH, `Notes can be at most ${MAX_NOTES_LENGTH} characters.`),
}

/** What a User sends to add an Opponent. */
export const newOpponentSchema = z.object({
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

/** An Opponent with every Round against them, newest first. */
export interface OpponentDetailView extends OpponentView {
  rounds: OpponentRoundView[]
}
