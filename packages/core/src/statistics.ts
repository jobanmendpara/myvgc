import { type AppliedFilters, type Rate, rate, tally } from './dashboard'
import { type OpponentTeamView, opponentTeamOf } from './opponent-team'
import {
  type Game,
  type GameNumber,
  type RoundResult,
  type RoundView,
  type Tally,
  tallyResult,
} from './round'

/** What a Round shows when it is listed behind a Statistics row: where it was, who, and how. */
type RoundListing = Pick<
  RoundView,
  'id' | 'phase' | 'roundNumber' | 'stage' | 'result' | 'gameScore' | 'opponent'
>

/** A Round as Statistics need it. */
export type StatisticsRound = RoundListing & Pick<RoundView, 'bye' | 'games'>

/** A Tournament as Statistics need it: its Rounds and the species of its Opponent's Teams. */
export interface StatisticsTournament {
  id: string
  name: string
  /** In the order they were played. */
  rounds: StatisticsRound[]
  opponentTeams: { opponentId: OpponentTeamView['opponentId']; pokemon: { species: string }[] }[]
}

/**
 * A Round or Game a Statistics row counted: the Round's id, and the Game's number when the
 * table counts Games. The Round is looked up in `Statistics.rounds`.
 */
export interface Counted {
  round: string
  game?: GameNumber
}

/** A Round behind a Statistics row, with its Tournament and its Game results. */
export type CountedRound = RoundListing & {
  tournament: { id: string; name: string }
  games: Pick<Game, 'number' | 'result'>[]
}

/**
 * A row of a Statistics table: its record, how many Rounds or Games it was counted in, and
 * which ones, in the order the Tournaments were given and then as played.
 */
export type StatisticsRow<S> = Rate & { species: S; played: number; counted: Counted[] }

/**
 * How many Rounds or Games a table counted, out of how many, and how many were left out for
 * each reason.
 */
export type Coverage<Reason extends LeftOutReason> = { counted: number; of: number } & Record<
  Reason,
  number
>

export interface StatisticsTable<S, Reason extends LeftOutReason> {
  /** Largest sample first. */
  rows: StatisticsRow<S>[]
  coverage: Coverage<Reason>
}

/** Why a Round or Game was left out of a table, as it reads after "7 have". */
const LEFT_OUT = {
  noOpponentTeam: 'no Opponent’s Team',
  noResult: 'no Game result',
  noLeads: 'no Leads',
  oneLead: 'only one Lead',
  noBrought: 'no Brought Pokémon',
} as const
export type LeftOutReason = keyof typeof LEFT_OUT

type FacedReason = 'noOpponentTeam'
type LeadPairReason = 'noResult' | 'noLeads' | 'oneLead'
type LeadReason = 'noResult' | 'noLeads'
type BroughtReason = 'noResult' | 'noBrought'

export interface Statistics {
  /** Per species on an Opponent's Team, counting Rounds. */
  speciesFaced: StatisticsTable<string, FacedReason>
  /** Per Lead pair of the User's, counting Games. Each pair is in alphabetical order. */
  leadPairs: StatisticsTable<[string, string], LeadPairReason>
  /** Per species that was one of the User's Leads, counting Games. */
  leads: StatisticsTable<string, LeadReason>
  /** Per species the User Brought, counting Games. */
  brought: StatisticsTable<string, BroughtReason>
  /** Every Round the tables could count (all but Byes), by id, to list what a row counts. */
  rounds: Record<string, CountedRound>
}

/** What the Statistics endpoint answers: the tables and the filters it applied. */
export interface StatisticsView {
  filters: AppliedFilters & { team: string | null }
  statistics: Statistics
}

const played = (t: Tally) => t.wins + t.losses + t.ties

/** A table being counted: a tally per row, and its coverage. */
class Table<S, Reason extends LeftOutReason> {
  private readonly byKey = new Map<string, { species: S; tally: Tally; counted: Counted[] }>()
  private readonly coverage: Coverage<Reason>

  constructor(reasons: readonly Reason[]) {
    const leftOut = Object.fromEntries(reasons.map((reason) => [reason, 0])) as Record<
      Reason,
      number
    >
    this.coverage = { counted: 0, of: 0, ...leftOut }
  }

  leaveOut(reason: Reason) {
    this.coverage.of++
    this.coverage[reason]++
  }

  /** Counts one Round or Game with this result in the row of each of its species or pairs. */
  count(subjects: S[], result: RoundResult, counted: Counted) {
    this.coverage.of++
    this.coverage.counted++
    for (const species of subjects) {
      const key = String(species)
      const entry = this.byKey.get(key) ?? { species, tally: tally(), counted: [] }
      tallyResult(entry.tally, result)
      entry.counted.push(counted)
      this.byKey.set(key, entry)
    }
  }

  read(): StatisticsTable<S, Reason> {
    const rows = [...this.byKey.entries()]
      .sort(([a, x], [b, y]) => played(y.tally) - played(x.tally) || a.localeCompare(b))
      .map(([, { species, tally: t, counted }]) => ({
        species,
        played: played(t),
        ...rate(t),
        counted,
      }))
    return { rows, coverage: this.coverage }
  }
}

/**
 * What the recorded Opponent's Teams and Games say about how the User plays, from Tournaments
 * that have already been filtered. Byes are left out; Ties count as played but not won.
 */
export function statistics(tournaments: StatisticsTournament[]): Statistics {
  const faced = new Table<string, FacedReason>(['noOpponentTeam'])
  const leadPairs = new Table<[string, string], LeadPairReason>(['noResult', 'noLeads', 'oneLead'])
  const leads = new Table<string, LeadReason>(['noResult', 'noLeads'])
  const brought = new Table<string, BroughtReason>(['noResult', 'noBrought'])
  const rounds: Record<string, CountedRound> = {}

  for (const t of tournaments) {
    for (const r of t.rounds) {
      if (r.bye) continue
      const { id, phase, roundNumber, stage, result, gameScore, opponent } = r
      rounds[id] = {
        id,
        tournament: { id: t.id, name: t.name },
        phase,
        roundNumber,
        stage,
        result,
        gameScore,
        opponent,
        games: r.games.map((g) => ({ number: g.number, result: g.result })),
      }

      const team = opponentTeamOf(t.opponentTeams, r.opponent?.id)
      if (team)
        faced.count(
          team.pokemon.map((p) => p.species),
          r.result,
          { round: id },
        )
      else faced.leaveOut('noOpponentTeam')

      for (const game of r.games) {
        const counted = { round: id, game: game.number }
        if (!game.result) {
          for (const table of [leadPairs, leads, brought]) table.leaveOut('noResult')
          continue
        }
        const [first, second] = [...game.leads].sort()
        if (!first) leadPairs.leaveOut('noLeads')
        else if (!second) leadPairs.leaveOut('oneLead')
        else leadPairs.count([[first, second]], game.result, counted)
        if (game.leads.length) leads.count(game.leads, game.result, counted)
        else leads.leaveOut('noLeads')
        if (game.brought.length) brought.count(game.brought, game.result, counted)
        else brought.leaveOut('noBrought')
      }
    }
  }

  return {
    speciesFaced: faced.read(),
    leadPairs: leadPairs.read(),
    leads: leads.read(),
    brought: brought.read(),
    rounds,
  }
}

/** A table's coverage line, such as "Based on 34 of 41 Rounds, 7 have no Opponent’s Team". */
export function describeCoverage(
  { counted, of, ...leftOut }: Coverage<never> & Partial<Record<LeftOutReason, number>>,
  unit: 'Rounds' | 'Games',
): string {
  if (!of) return `No ${unit} yet`
  const noun = of === 1 ? unit.slice(0, -1) : unit
  if (counted === of) return of === 1 ? `Based on 1 ${noun}` : `Based on all ${of} ${unit}`
  const reasons = (Object.entries(leftOut) as [LeftOutReason, number][])
    .filter(([, n]) => n)
    .map(([reason, n]) => `${n} ${n === 1 ? 'has' : 'have'} ${LEFT_OUT[reason]}`)
  return [`Based on ${counted} of ${of} ${noun}`, ...reasons].join(', ')
}
