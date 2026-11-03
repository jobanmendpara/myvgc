import { z } from 'zod'

export const STAT_IDS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const
export type StatId = (typeof STAT_IDS)[number]

/** Most Stat Points one stat can have. */
export const MAX_STAT_POINTS = 32
/** Most Stat Points a Pokémon can have in total. */
export const MAX_TOTAL_STAT_POINTS = 66
export const MAX_MOVES = 4
export const MAX_TEAM_SIZE = 6

/** A Showdown ID: lowercase letters and digits, such as `rotomwash` or `sitrusberry`. */
const showdownId = z.string().regex(/^[a-z0-9]+$/, 'Must be a Showdown ID')

const statPoint = z.number().int().min(0).max(MAX_STAT_POINTS).default(0)

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

export const pokemonBuildSchema = z.object({
  species: showdownId,
  nickname: z.string().min(1).optional(),
  gender: z.enum(['M', 'F']).optional(),
  item: showdownId.optional(),
  ability: showdownId.optional(),
  nature: showdownId.optional(),
  moves: z.array(showdownId).max(MAX_MOVES),
  statPoints: statPointsSchema,
})

/** The Pokémon builds of a Team: 1 to 6. */
export const teamPokemonSchema = z.array(pokemonBuildSchema).min(1).max(MAX_TEAM_SIZE)

export type StatPoints = z.infer<typeof statPointsSchema>
export type PokemonBuild = z.infer<typeof pokemonBuildSchema>

export function totalStatPoints(points: Record<StatId, number>): number {
  return STAT_IDS.reduce((sum, stat) => sum + points[stat], 0)
}
