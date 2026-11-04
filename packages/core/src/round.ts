import { z } from 'zod'
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
    return issues
  }

  if (!round.hasOpponent) add('opponent', 'Choose who you played, or add them.')
  if (round.gameScore) {
    const { won, lost } = round.gameScore
    if (round.bestOf === 1) add('gameScore', 'Only best-of-3 Rounds have a Game score.')
    else if (won > 2 || lost > 2 || won + lost > 3 || (won === 2 && lost === 2))
      add('gameScore', 'That Game score isn’t possible in best of 3.')
  } else if (round.result === null) {
    add('result', 'Choose Win, Loss or Tie.')
  }
  return issues
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
 * (`opponentId`) or a new one to add on the spot (`newOpponentName`). Rules across fields are
 * checked with `roundIssues` once defaults are filled in.
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
})

export type RoundInput = z.input<typeof roundInputSchema>

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
  createdAt: string
  updatedAt: string
}

/** What the API answers after a Round is saved: the Round and the Tournament's new standing. */
export interface SavedRound {
  round: RoundView
  record: TournamentRecord
  /** Offered when the Top cut implies a Placement the Tournament doesn't have yet. */
  suggestedPlacement: number | null
}
