import { z } from 'zod'
import { showdownId } from './build'
import { clientIdSchema } from './client-id'
import { type OpponentTeamView, opponentTeamSchema } from './opponent-team'
import { MAX_NOTES_LENGTH } from './team'
import { BEST_OF, type BestOf } from './tournament'

export const ROUND_PHASES = ['swiss', 'top-cut'] as const
export type RoundPhase = (typeof ROUND_PHASES)[number]

/** Top cut stages, from the biggest cut to the Finals. */
export const TOP_CUT_STAGES = ['top-64', 'top-32', 'top-16', 'top-8', 'top-4', 'finals'] as const
export type TopCutStage = (typeof TOP_CUT_STAGES)[number]

export const TOP_CUT_STAGE_LABELS: Record<TopCutStage, string> = {
  'top-64': 'Top 64',
  'top-32': 'Top 32',
  'top-16': 'Top 16',
  'top-8': 'Top 8',
  'top-4': 'Top 4',
  finals: 'Finals',
}

export const ROUND_RESULTS = ['win', 'loss', 'tie'] as const
export type RoundResult = (typeof ROUND_RESULTS)[number]

export const ROUND_RESULT_LABELS: Record<RoundResult, string> = {
  win: 'Win',
  loss: 'Loss',
  tie: 'Tie',
}

/** Games won and lost by the User in a best-of-3 Round. */
export interface GameScore {
  won: number
  lost: number
}

export const MAX_OPPONENT_NAME_LENGTH = 100

/** Most Pokémon each side brings to a Game. */
export const MAX_BROUGHT = 4
/** Most Pokémon each side leads with. */
export const MAX_LEADS = 2
export const GAME_NUMBERS = [1, 2, 3] as const
export type GameNumber = (typeof GAME_NUMBERS)[number]

/** Each side of a Game: the Brought Pokémon field, and the Leads field that goes with it. */
export const GAME_SIDES = [
  { brought: 'brought', leads: 'leads' },
  { brought: 'opponentBrought', leads: 'opponentLeads' },
] as const

/** The positions of IDs already listed earlier in the same list. */
const repeated = (ids: readonly string[]) =>
  ids.flatMap((id, index) => (ids.indexOf(id) < index ? [index] : []))

const speciesList = (max: number, message: string) =>
  z.array(showdownId).max(max, message).default([])

/**
 * A single battle within a Round, as far as the User recorded it. Pokémon are species IDs
 * (ADR 14), and every field is optional (ADR 21).
 */
export const gameSchema = z
  .object({
    number: z.union(
      GAME_NUMBERS.map((n) => z.literal(n)) as [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>],
      'Games are numbered 1 to 3.',
    ),
    brought: speciesList(MAX_BROUGHT, `Each side brings at most ${MAX_BROUGHT} Pokémon.`),
    leads: speciesList(MAX_LEADS, `Each side leads with at most ${MAX_LEADS} Pokémon.`),
    opponentBrought: speciesList(MAX_BROUGHT, `Each side brings at most ${MAX_BROUGHT} Pokémon.`),
    opponentLeads: speciesList(MAX_LEADS, `Each side leads with at most ${MAX_LEADS} Pokémon.`),
    result: z.enum(ROUND_RESULTS).nullable().default(null),
    notes: z
      .string()
      .max(MAX_NOTES_LENGTH, `Notes can be at most ${MAX_NOTES_LENGTH} characters.`)
      .default(''),
  })
  .superRefine((game, ctx) => {
    for (const side of GAME_SIDES) {
      for (const index of repeated(game[side.brought]))
        ctx.addIssue({ code: 'custom', path: [side.brought, index], message: 'Already brought.' })
      for (const index of repeated(game[side.leads]))
        ctx.addIssue({ code: 'custom', path: [side.leads, index], message: 'Already a Lead.' })
      game[side.leads].forEach((lead, index) => {
        if (!game[side.brought].includes(lead))
          ctx.addIssue({
            code: 'custom',
            path: [side.leads, index],
            message: 'A Lead must be one of the Brought Pokémon.',
          })
      })
    }
  })

export type Game = z.output<typeof gameSchema>
export type GameInput = z.input<typeof gameSchema>

/** Whether nothing about a Game was recorded. */
export const isEmptyGame = (game: Omit<Game, 'number'>) =>
  GAME_SIDES.every((side) => !game[side.brought].length && !game[side.leads].length) &&
  game.result === null &&
  !game.notes.trim()

/** What a Game result counts for in a Round's Game score. */
type GameFacts = Pick<Game, 'number' | 'result'>

/**
 * How far the Game results go. A best-of-3 Round is decided once a side has won 2 Games, or
 * after Game 3, counting only Games with no unrecorded Game before them. `decidedAfter` is the
 * Game that decided it, if the results go that far; `won` and `lost` count every Game.
 */
function readGames(games: readonly GameFacts[]) {
  const results = new Map(games.map((game) => [game.number, game.result]))
  let won = 0
  let lost = 0
  let decidedAfter: GameNumber | undefined
  for (const number of GAME_NUMBERS) {
    const result = results.get(number)
    if (!result) break
    if (result === 'win') won++
    if (result === 'loss') lost++
    if (won === 2 || lost === 2 || number === 3) {
      decidedAfter = number
      break
    }
  }
  const total = (result: RoundResult) => games.filter((game) => game.result === result).length
  return {
    score: decidedAfter ? { won, lost } : null,
    decidedAfter,
    won: total('win'),
    lost: total('loss'),
  }
}

/**
 * The Game score the Game results add up to in a best-of-3 Round, or nothing while they are
 * partial. In a best-of-1 Round, Game 1's result is the Round's instead (see `settleRound`).
 */
export function gameScoreFromGames(round: { bestOf: BestOf; games: readonly GameFacts[] }) {
  return round.bestOf === 3 ? readGames(round.games).score : null
}

const scoreText = ({ won, lost }: GameScore) => `${won}-${lost}`

/** What decides whether a Round is valid and what its result is. */
export interface RoundFacts {
  phase: RoundPhase
  roundNumber: number | null
  stage: TopCutStage | null
  bestOf: BestOf
  bye: boolean
  /** The result the User chose. A Game score, when given, decides instead. */
  result: RoundResult | null
  gameScore: GameScore | null
  hasOpponent: boolean
  games: GameFacts[]
  /** Whether an Opponent's Team with Pokémon in it was sent with the Round (ADR 22). */
  hasOpponentTeam: boolean
}

type Issue = { path: string[]; message: string }

/** Everything wrong with a Round, against the field to show it on. */
export function roundIssues(round: RoundFacts): Issue[] {
  const issues: Issue[] = []
  const add = (field: string, message: string) => issues.push({ path: [field], message })

  if (round.phase === 'swiss') {
    if (round.roundNumber === null) add('roundNumber', 'Give the Swiss round number.')
    if (round.stage !== null) add('stage', 'Only Top cut Rounds have a stage.')
  } else {
    if (round.stage === null) add('stage', 'Choose the Top cut stage.')
    if (round.roundNumber !== null)
      add('roundNumber', 'Top cut Rounds are named by stage, not numbered.')
  }

  if (round.bye) {
    if (round.hasOpponent) add('opponent', 'A Bye has no Opponent.')
    if (round.gameScore) add('gameScore', 'A Bye has no Game score.')
    if (round.games.length) add('games', 'A Bye has no Games.')
    if (round.hasOpponentTeam) add('opponentTeam', 'A Bye has no Opponent’s Team.')
    return issues
  }

  if (!round.hasOpponent) add('opponent', 'Choose who you played, or add them.')
  if (!round.hasOpponent && round.hasOpponentTeam)
    add('opponentTeam', 'Choose who you played before their Team.')
  // Changing best-of never drops recorded Games (ADR 21).
  const beyond = round.games.filter((game) => game.number > round.bestOf).map((g) => g.number)
  if (beyond.length)
    add(
      'bestOf',
      `This Round has Game ${beyond.join(' and ')} recorded. Remove ${beyond.length > 1 ? 'them' : 'it'} first.`,
    )

  const games = readGames(round.games)
  if (round.bestOf === 1) {
    const game = round.games.find((g) => g.number === 1)?.result ?? null
    if (round.gameScore) add('gameScore', 'Only best-of-3 Rounds have a Game score.')
    else if (game && round.result && game !== round.result)
      add('result', `Game 1 was a ${ROUND_RESULT_LABELS[game]}.`)
    else if (!game && round.result === null) add('result', 'Choose Win, Loss or Tie.')
    return issues
  }

  if (games.won > 2 || games.lost > 2) add('games', 'Only 2 Games can be won or lost in best of 3.')
  else if (
    games.decidedAfter &&
    round.games.some((g) => g.number > games.decidedAfter! && g.result)
  )
    add('games', `The Round was over after Game ${games.decidedAfter}.`)

  if (round.gameScore) {
    const { won, lost } = round.gameScore
    if (won > 2 || lost > 2 || won + lost > 3 || (won === 2 && lost === 2))
      add('gameScore', 'That Game score isn’t possible in best of 3.')
    else if (games.score && scoreText(games.score) !== scoreText(round.gameScore))
      add('gameScore', `The Games add up to ${scoreText(games.score)}.`)
    else if (games.won > won || games.lost > lost)
      add('gameScore', `The Games already have ${games.won} won and ${games.lost} lost.`)
  } else if (games.score) {
    const decided = roundResult({ bye: false, result: null, gameScore: games.score })
    if (round.result && round.result !== decided)
      add(
        'result',
        `The Games add up to ${scoreText(games.score)}, a ${ROUND_RESULT_LABELS[decided]}.`,
      )
  } else if (round.result === null) {
    add('result', 'Choose Win, Loss or Tie.')
  }
  return issues
}

/**
 * A valid Round with what its Games decide filled in: the Game score in best of 3, or the result
 * in best of 1. A Game score or result the User gave stays, as `roundIssues` checked it agrees.
 */
export function settleRound<R extends RoundFacts>(round: R): R {
  if (round.bye) return round
  if (round.bestOf === 1) {
    const game = round.games.find((g) => g.number === 1)?.result ?? null
    return { ...round, result: round.result ?? game }
  }
  return { ...round, gameScore: round.gameScore ?? gameScoreFromGames(round) }
}

/** A Round's result: a Bye is a win, and a Game score decides over the chosen result. */
export function roundResult(round: Pick<RoundFacts, 'bye' | 'result' | 'gameScore'>): RoundResult {
  if (round.bye) return 'win'
  if (round.gameScore) {
    const { won, lost } = round.gameScore
    return won > lost ? 'win' : won < lost ? 'loss' : 'tie'
  }
  return round.result ?? 'tie'
}

export interface Tally {
  wins: number
  losses: number
  ties: number
}

/** A Tournament's Record, Swiss and Top cut kept apart. Byes count as wins here. */
export interface TournamentRecord {
  swiss: Tally
  topCut: Tally
}

const emptyTally = (): Tally => ({ wins: 0, losses: 0, ties: 0 })

/** Adds one result to a tally. */
export function tallyResult(tally: Tally, result: RoundResult): void {
  if (result === 'win') tally.wins++
  else if (result === 'loss') tally.losses++
  else tally.ties++
}

export function recordOf(
  rounds: Pick<RoundFacts, 'phase' | 'bye' | 'result' | 'gameScore'>[],
): TournamentRecord {
  const record = { swiss: emptyTally(), topCut: emptyTally() }
  for (const round of rounds)
    tallyResult(round.phase === 'swiss' ? record.swiss : record.topCut, roundResult(round))
  return record
}

/** A tally as players write it, such as `6-2-0`. */
export const formatRecord = ({ wins, losses, ties }: Tally) => `${wins}-${losses}-${ties}`

// The best Placement a User can have after losing in each stage.
const PLACEMENT_AFTER_LOSING: Record<TopCutStage, number> = {
  'top-64': 33,
  'top-32': 17,
  'top-16': 9,
  'top-8': 5,
  'top-4': 3,
  finals: 2,
}

/**
 * The Placement the Top cut suggests: where losing in a stage leaves the User, or 1st for
 * winning the Finals. Nothing while they are still in, or if they never made Top cut.
 */
export function suggestedPlacement(
  rounds: Pick<RoundFacts, 'phase' | 'stage' | 'bye' | 'result' | 'gameScore'>[],
): number | undefined {
  for (const round of rounds) {
    if (round.phase !== 'top-cut' || !round.stage) continue
    const result = roundResult(round)
    if (round.stage === 'finals' && result === 'win') return 1
    if (result === 'loss') return PLACEMENT_AFTER_LOSING[round.stage]
  }
  return undefined
}

/** Orders Rounds as they were played: Swiss by number, then Top cut by stage. */
export function compareRounds(
  a: Pick<RoundFacts, 'phase' | 'roundNumber' | 'stage'>,
  b: Pick<RoundFacts, 'phase' | 'roundNumber' | 'stage'>,
): number {
  if (a.phase !== b.phase) return a.phase === 'swiss' ? -1 : 1
  if (a.phase === 'swiss') return (a.roundNumber ?? 0) - (b.roundNumber ?? 0)
  return TOP_CUT_STAGES.indexOf(a.stage!) - TOP_CUT_STAGES.indexOf(b.stage!)
}

const gameCount = z.number().int().min(0).max(3)

/**
 * What a User sends to log or change a Round. The Opponent is either one they have
 * (`opponentId`) or a new one to add on the spot (`newOpponentName`, optionally under
 * `newOpponentId`). A Swiss Round with no `roundNumber` takes the next free one, so leave it out
 * unless the User typed it. Rules across fields are checked with `roundIssues` once defaults are
 * filled in.
 */
export const roundInputSchema = z.object({
  phase: z.enum(ROUND_PHASES).default('swiss'),
  roundNumber: z.number().int().min(1, 'Round numbers start at 1.').max(99).nullable().optional(),
  stage: z.enum(TOP_CUT_STAGES).nullable().optional(),
  bestOf: z
    .union(
      BEST_OF.map((n) => z.literal(n)) as [z.ZodLiteral<1>, z.ZodLiteral<3>],
      'Rounds are best of 1 or best of 3.',
    )
    .optional(),
  bye: z.boolean().default(false),
  result: z.enum(ROUND_RESULTS).nullable().optional(),
  gameScore: z.object({ won: gameCount, lost: gameCount }).nullable().optional(),
  opponentId: z.uuid('Choose one of your Opponents.').nullable().optional(),
  newOpponentId: clientIdSchema,
  newOpponentName: z
    .string()
    .trim()
    .min(1, 'Give the Opponent a name.')
    .max(MAX_OPPONENT_NAME_LENGTH, `Names can be at most ${MAX_OPPONENT_NAME_LENGTH} characters.`)
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(MAX_NOTES_LENGTH, `Notes can be at most ${MAX_NOTES_LENGTH} characters.`)
    .default(''),
  // Saved with the Round, so they travel through the outbox with it (ADR 17, ADR 21).
  games: z
    .array(gameSchema)
    .max(GAME_NUMBERS.length, `A Round has at most ${GAME_NUMBERS.length} Games.`)
    .default([])
    .superRefine((games, ctx) => {
      repeated(games.map((game) => String(game.number))).forEach((index) =>
        ctx.addIssue({
          code: 'custom',
          path: [index, 'number'],
          message: `Game ${games[index]!.number} is listed twice.`,
        }),
      )
    }),
  // The Opponent's Team in this Tournament, shared by every Round against them (ADR 22). Left
  // out, it stays as it is.
  opponentTeam: opponentTeamSchema.optional(),
})

export type RoundInput = z.input<typeof roundInputSchema>

/** What a User sends to log a new Round. */
export const newRoundSchema = roundInputSchema.extend({ id: clientIdSchema })

export type NewRound = z.input<typeof newRoundSchema>

/** A Round as the API returns it. */
export interface RoundView {
  id: string
  tournamentId: string
  phase: RoundPhase
  roundNumber: number | null
  stage: TopCutStage | null
  bestOf: BestOf
  bye: boolean
  result: RoundResult
  gameScore: GameScore | null
  opponent: { id: string; displayName: string } | null
  notes: string
  /** Its recorded Games, by number. Numbers can be missing. */
  games: Game[]
  createdAt: string
  updatedAt: string
}

/** What the API answers after a Round is saved: the Round and the Tournament's new standing. */
export interface SavedRound {
  round: RoundView
  record: TournamentRecord
  /** Offered when the Top cut implies a Placement the Tournament doesn't have yet. */
  suggestedPlacement: number | null
  /** The Opponent's Team of the Round's Opponent in this Tournament, if any. */
  opponentTeam: OpponentTeamView | null
}
