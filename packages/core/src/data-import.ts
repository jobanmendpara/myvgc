import { checkGames, checkPokemon } from './check-pokemon'
import { type ImportIssue, type ReadDataExport, recordLabel } from './data-export'
import {
  type Game,
  type GameScore,
  type RoundFacts,
  type RoundResult,
  TOP_CUT_STAGE_LABELS,
  roundIssues,
  roundResult,
  settleRound,
} from './round'
import type { BestOf } from './tournament'

type ImportedRound = ReadDataExport['tournaments'][number]['rounds'][number]

/** What decides whether an imported Round is valid, with its Tournament's default best-of. */
function factsOf(round: ImportedRound, defaultBestOf: BestOf): RoundFacts & { games: Game[] } {
  return {
    phase: round.phase,
    roundNumber: round.roundNumber ?? null,
    stage: round.stage ?? null,
    bestOf: round.bestOf ?? defaultBestOf,
    bye: round.bye,
    result: round.result,
    gameScore: round.gameScore ?? null,
    hasOpponent: Boolean(round.opponentId),
    // An imported Round's Opponent's Team is checked with its Tournament instead.
    hasOpponentTeam: false,
    games: round.games.toSorted((a, b) => a.number - b.number),
  }
}

/** A valid imported Round as it is saved: the same columns a normal save fills in. */
export function settleImportedRound(
  round: ImportedRound,
  defaultBestOf: BestOf,
): Omit<RoundFacts, 'result' | 'gameScore' | 'hasOpponent' | 'hasOpponentTeam' | 'games'> & {
  result: RoundResult
  gameScore: GameScore | null
  games: Game[]
} {
  const settled = settleRound(factsOf(round, defaultBestOf))
  const { phase, roundNumber, stage, bestOf, bye, games, gameScore } = settled
  return { phase, roundNumber, stage, bestOf, bye, games, gameScore, result: roundResult(settled) }
}

/** What an import needs to know about the account it goes into. */
export interface ImportAccount {
  /** The ids of the User's Opponents that the file's Rounds name. */
  opponentIds: ReadonlySet<string>
}

/**
 * Checks a Data export that has been read, before anything is written: the Champions data checks
 * a normal write gets, the rules a Round is saved with, clashes within the file, and that every
 * Round's Opponent is in the file or the account. A Team snapshot's link to its Team may dangle,
 * as the snapshot keeps its own copy.
 */
export function checkDataExport(file: ReadDataExport, account: ImportAccount): ImportIssue[] {
  const issues: ImportIssue[] = []
  const add = (path: (string | number)[], message: string) =>
    issues.push({ path, record: recordLabel(file, path), message })
  const addAll = (
    prefix: (string | number)[],
    found: { path: (string | number)[]; message: string }[],
  ) => found.forEach((issue) => add([...prefix, ...issue.path], issue.message))

  // IDs are unique per kind of record, so one file can't hold the same record twice.
  const seen = new Map<string, Set<string>>()
  const once = (kind: string, id: string, path: (string | number)[]) => {
    const ids = seen.get(kind) ?? seen.set(kind, new Set()).get(kind)!
    if (ids.has(id)) add([...path, 'id'], 'This ID is used twice in the file.')
    ids.add(id)
  }

  file.teams.forEach((team, t) => {
    once('team', team.id, ['teams', t])
    addAll(['teams', t], checkPokemon(team.pokemon))
  })

  const opponentIds = new Set(account.opponentIds)
  file.opponents.forEach((opponent, o) => {
    once('opponent', opponent.id, ['opponents', o])
    opponentIds.add(opponent.id)
    opponent.noteEntries.forEach((entry, n) =>
      once('noteEntry', entry.id, ['opponents', o, 'noteEntries', n]),
    )
  })

  file.tournaments.forEach((tournament, t) => {
    once('tournament', tournament.id, ['tournaments', t])
    if (tournament.team) addAll(['tournaments', t, 'team'], checkPokemon(tournament.team.pokemon))

    const numbers = new Set<number>()
    const stages = new Set<string>()
    tournament.rounds.forEach((round, r) => {
      const path = ['tournaments', t, 'rounds', r]
      once('round', round.id, path)
      const facts = factsOf(round, tournament.defaultBestOf)
      addAll(path, [...roundIssues(facts), ...checkGames(round.games)])
      if (round.opponentId && !opponentIds.has(round.opponentId))
        add([...path, 'opponentId'], 'Its Opponent isn’t in the file or in your account.')

      if (facts.roundNumber !== null) {
        if (numbers.has(facts.roundNumber))
          add(
            [...path, 'roundNumber'],
            `Round ${facts.roundNumber} is listed twice in this Tournament.`,
          )
        numbers.add(facts.roundNumber)
      }
      if (facts.stage !== null) {
        if (stages.has(facts.stage))
          add(
            [...path, 'stage'],
            `${TOP_CUT_STAGE_LABELS[facts.stage]} is listed twice in this Tournament.`,
          )
        stages.add(facts.stage)
      }
    })

    // An Opponent's Team only exists for an Opponent played in that Tournament (ADR 22).
    const played = new Set(tournament.rounds.map((round) => round.opponentId))
    const teamsOf = new Set<string>()
    tournament.opponentTeams.forEach((team, o) => {
      const path = ['tournaments', t, 'opponentTeams', o]
      once('opponentTeam', team.id, path)
      addAll(path, checkPokemon(team.pokemon))
      if (teamsOf.has(team.opponentId))
        add([...path, 'opponentId'], 'This Opponent’s Team is listed twice in this Tournament.')
      else if (!played.has(team.opponentId))
        add([...path, 'opponentId'], 'No Round in this Tournament is against this Opponent.')
      teamsOf.add(team.opponentId)
    })
  })
  return issues
}
