import { z } from 'zod'

export const STAT_IDS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const
export type StatId = (typeof STAT_IDS)[number]

export const STAT_LABELS: Record<StatId, string> = {
  hp: 'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
}

/** Most Stat Points one stat can have. */
export const MAX_STAT_POINTS = 32
/** Most Stat Points a Pokémon can have in total. */
export const MAX_TOTAL_STAT_POINTS = 66
export const MAX_MOVES = 4
export const MAX_TEAM_SIZE = 6
export const MAX_NICKNAME_LENGTH = 100

/** A Showdown ID: lowercase letters and digits, such as `rotomwash` or `sitrusberry`. */
export const showdownId = z.string().regex(/^[a-z0-9]+$/, 'Must be a Showdown ID')

const statPoint = z
  .number()
  .int('Stat Points are whole numbers.')
  .min(0, "Stat Points can't be negative.")
  .max(MAX_STAT_POINTS, `The most for one stat is ${MAX_STAT_POINTS} Stat Points.`)
  .default(0)

export const statPointsSchema = z
  .object({
    hp: statPoint,
    atk: statPoint,
    def: statPoint,
    spa: statPoint,
    spd: statPoint,
    spe: statPoint,
  })
  .refine((points) => totalStatPoints(points) <= MAX_TOTAL_STAT_POINTS, {
    message: `Stat Points can add up to at most ${MAX_TOTAL_STAT_POINTS}`,
  })

/**
 * The positions of moves already listed earlier in the same build. The same move twice is
 * malformed data, not legality (ADR 14).
 */
export function repeatedMoves(moves: readonly string[]): number[] {
  return moves.flatMap((move, index) => (moves.indexOf(move) < index ? [index] : []))
}

export const pokemonBuildSchema = z.object({
  species: z
    .string()
    .min(1, 'Choose a species or remove this Pokémon')
    .regex(/^([a-z0-9]+)?$/, 'Must be a Showdown ID'),
  // One line of a paste, so no line breaks.
  nickname: z
    .string()
    .min(1)
    .max(MAX_NICKNAME_LENGTH, `Nicknames can be at most ${MAX_NICKNAME_LENGTH} characters.`)
    .regex(/^[^\r\n]*$/, 'Nicknames must fit on one line.')
    .optional(),
  gender: z.enum(['M', 'F']).optional(),
  item: showdownId.optional(),
  ability: showdownId.optional(),
  nature: showdownId.optional(),
  moves: z
    .array(showdownId)
    .max(MAX_MOVES, `A Pokémon has at most ${MAX_MOVES} moves.`)
    .superRefine((moves, ctx) => {
      for (const index of repeatedMoves(moves)) {
        ctx.addIssue({
          code: 'custom',
          path: [index],
          message: 'This Pokémon already has this move.',
        })
      }
    }),
  statPoints: statPointsSchema,
})

/** The Pokémon builds of a Team: 1 to 6. */
export const teamPokemonSchema = z
  .array(pokemonBuildSchema)
  .min(1, 'A Team needs at least one Pokémon.')
  .max(MAX_TEAM_SIZE, `A Team has at most ${MAX_TEAM_SIZE} Pokémon.`)

export type StatPoints = z.infer<typeof statPointsSchema>
export type PokemonBuild = z.infer<typeof pokemonBuildSchema>

export function totalStatPoints(points: Record<StatId, number>): number {
  return STAT_IDS.reduce((sum, stat) => sum + points[stat], 0)
}
