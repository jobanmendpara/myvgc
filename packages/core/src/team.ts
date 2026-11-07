import { z } from 'zod'
import { MAX_MOVES, MAX_TEAM_SIZE, type PokemonBuild, showdownId, teamPokemonSchema } from './build'

/** Champions Regulations a Team can be tagged with, oldest first. */
export const REGULATIONS = ['M-A', 'M-B', 'M-C'] as const
export type Regulation = (typeof REGULATIONS)[number]
export const DEFAULT_REGULATION: Regulation = 'M-C'

export const MAX_TEAM_NAME_LENGTH = 100
export const MAX_NOTES_LENGTH = 20_000
/** Six Pokémon with long nicknames and every line filled in stay well under this. */
export const MAX_PASTE_LENGTH = 10_000

const teamName = z
  .string()
  .trim()
  .min(1, 'Give the Team a name.')
  .max(MAX_TEAM_NAME_LENGTH, `Team names can be at most ${MAX_TEAM_NAME_LENGTH} characters.`)

const teamNotes = z
  .string()
  .max(MAX_NOTES_LENGTH, `Notes can be at most ${MAX_NOTES_LENGTH} characters.`)

/** What a User sends to create a Team: from a paste, or from the Team builder's Pokémon builds. */
export const newTeamSchema = z
  .object({
    name: teamName,
    regulation: z.enum(REGULATIONS).default(DEFAULT_REGULATION),
    paste: z
      .string()
      .max(MAX_PASTE_LENGTH, `Pastes can be at most ${MAX_PASTE_LENGTH} characters.`)
      .optional(),
    pokemon: teamPokemonSchema.optional(),
    notes: teamNotes.default(''),
  })
  .refine((team) => (team.paste === undefined) !== (team.pokemon === undefined), {
    message: 'Send either a paste or Pokémon builds.',
    path: ['paste'],
  })

/** The whole Team, which replaces what is saved. Nothing is left to a default. */
export const teamSchema = z.object({
  name: teamName,
  regulation: z.enum(REGULATIONS),
  notes: teamNotes,
  pokemon: teamPokemonSchema,
})

export type TeamBody = z.infer<typeof teamSchema>
export type NewTeam = z.input<typeof newTeamSchema>

/** What the Team builder sends to have unsaved Pokémon builds judged. A slot may have no species yet. */
export const legalityCheckSchema = z.object({
  regulation: z.enum(REGULATIONS),
  pokemon: z
    .array(
      z.object({
        species: showdownId.nullable(),
        item: showdownId.optional(),
        ability: showdownId.optional(),
        moves: z.array(showdownId).max(MAX_MOVES).optional(),
      }),
    )
    .max(MAX_TEAM_SIZE, `A Team has at most ${MAX_TEAM_SIZE} Pokémon.`),
})

export type LegalityCheck = z.input<typeof legalityCheckSchema>

/** The parts of a Pokémon build legality looks at. */
export type LegalityBuild = z.infer<typeof legalityCheckSchema>['pokemon'][number]

/** Whether a Team breaks a Regulation's rules. MyVGC can't say for a Regulation it has no rules for. */
export type LegalityStatus = 'legal' | 'illegal' | 'unchecked'

/** One rule a Team breaks. */
export interface LegalityProblem {
  /** The field it's about, such as `['pokemon', 2, 'item']`, or `['pokemon']` for the whole Team. */
  path: [string, ...(string | number)[]]
  message: string
}

/** A Team judged against a Regulation. Worked out each time, never stored (ADR 18). */
export interface Legality {
  regulation: Regulation
  status: LegalityStatus
  problems: LegalityProblem[]
}

/** The problems about one Pokémon build. */
export const buildProblems = (legality: Legality, index: number): LegalityProblem[] =>
  legality.problems.filter((problem) => problem.path[1] === index)

/** Of one Pokémon build's problems, those about its move at `move`, to show next to that move. */
export const moveProblems = (problems: LegalityProblem[], move: number): LegalityProblem[] =>
  problems.filter((problem) => problem.path[2] === 'moves' && problem.path[3] === move)

/** Of one Pokémon build's problems, those not about one of its moves. */
export const wholeBuildProblems = (problems: LegalityProblem[]): LegalityProblem[] =>
  problems.filter((problem) => problem.path[2] !== 'moves')

/** The problems about the whole Team, such as Species Clause. */
export const teamProblems = (legality: Legality): LegalityProblem[] =>
  legality.problems.filter((problem) => problem.path.length === 1)

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
  /** Judged against its own Regulation. */
  legality: Legality
  createdAt: string
  updatedAt: string
}

/** The largest Teamsheet PDF MyVGC reads. */
export const MAX_TEAMSHEET_MB = 5
export const MAX_TEAMSHEET_BYTES = MAX_TEAMSHEET_MB * 1024 * 1024
export const TEAMSHEET_TOO_LARGE = `The file is larger than ${MAX_TEAMSHEET_MB} MB.`

/** Something a reader wasn't sure of in a Team it read from a file, shown next to that field. */
export interface ReadFlag {
  /** The field it's about, such as `['pokemon', 2, 'item']`. */
  path: [string, ...(string | number)[]]
  message: string
}

/** A draft Team read from a file (ADR 24), as the API returns it. Nothing is saved yet. */
export interface ReadTeamView {
  name: string
  pokemon: NamedPokemonBuild[]
  flags: ReadFlag[]
}
