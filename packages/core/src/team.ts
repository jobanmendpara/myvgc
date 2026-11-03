import { z } from 'zod'
import type { PokemonBuild } from './build'

/** Champions Regulations a Team can be tagged with, oldest first. */
export const REGULATIONS = ['M-A', 'M-B', 'M-C'] as const
export type Regulation = (typeof REGULATIONS)[number]
export const DEFAULT_REGULATION: Regulation = 'M-C'

export const MAX_TEAM_NAME_LENGTH = 100
export const MAX_NOTES_LENGTH = 20_000
/** Six Pokémon with long nicknames and every line filled in stay well under this. */
export const MAX_PASTE_LENGTH = 10_000

/** What a User sends to import a Team from a paste. */
export const newTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give the Team a name.')
    .max(MAX_TEAM_NAME_LENGTH, `Team names can be at most ${MAX_TEAM_NAME_LENGTH} characters.`),
  regulation: z.enum(REGULATIONS).default(DEFAULT_REGULATION),
  paste: z.string().max(MAX_PASTE_LENGTH, `Pastes can be at most ${MAX_PASTE_LENGTH} characters.`),
  notes: z
    .string()
    .max(MAX_NOTES_LENGTH, `Notes can be at most ${MAX_NOTES_LENGTH} characters.`)
    .default(''),
})

export type NewTeam = z.input<typeof newTeamSchema>

/** Display names for one Pokémon build, looked up from the Champions data. */
export interface PokemonBuildNames {
  species: string
  item?: string
  ability?: string
  nature?: string
  moves: string[]
}

/** A Pokémon build as the API returns it: stored IDs plus their display names. */
export type NamedPokemonBuild = PokemonBuild & { names: PokemonBuildNames }

/** A Team as the API returns it. */
export interface TeamView {
  id: string
  name: string
  regulation: Regulation
  notes: string
  pokemon: NamedPokemonBuild[]
  createdAt: string
  updatedAt: string
}
