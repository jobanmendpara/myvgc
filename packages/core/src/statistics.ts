import { type AppliedFilters, type Rate, rate, tally } from './dashboard'
import { type OpponentTeamView, opponentTeamOf } from './opponent-team'
import { type RoundResult, type RoundView, type Tally, tallyResult } from './round'

/** A Round as Statistics need it. */
export type StatisticsRound = Pick<RoundView, 'bye' | 'result' | 'opponent' | 'games'>

/** A Tournament as Statistics need it: its Rounds and the species of its Opponent's Teams. */
export interface StatisticsTournament {
  rounds: StatisticsRound[]
  opponentTeams: { opponentId: OpponentTeamView['opponentId']; pokemon: { species: string }[] }[]
}

/** A row of a Statistics table: its record, and how many Rounds or Games it was counted in. */
export type StatisticsRow<S> = Rate & { species: S; played: number }

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
}

/** What the Statistics endpoint answers: the tables and the filters it applied. */
export interface StatisticsView {
  filters: AppliedFilters & { team: string | null }
  statistics: Statistics
}

const played = (t: Tally) => t.wins + t.losses + t.ties

/** A table being counted: a tally per row, and its coverage. */
class Table<S, Reason extends LeftOutReason> {
  private readonly byKey = new Map<string, { species: S; tally: Tally }>()
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
  count(subjects: S[], result: RoundResult) {
    this.coverage.of++
    this.coverage.counted++
    for (const species of subjects) {
      const key = String(species)
      const entry = this.byKey.get(key) ?? { species, tally: tally() }
      tallyResult(entry.tally, result)
      this.byKey.set(key, entry)
    }
  }

  read(): StatisticsTable<S, Reason> {
    const rows = [...this.byKey.entries()]
      .sort(([a, x], [b, y]) => played(y.tally) - played(x.tally) || a.localeCompare(b))
      .map(([, { species, tally: t }]) => ({ species, played: played(t), ...rate(t) }))
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

  for (const t of tournaments) {
    for (const r of t.rounds) {
      if (r.bye) continue
      const team = opponentTeamOf(t.opponentTeams, r.opponent?.id)
      if (team)
        faced.count(
          team.pokemon.map((p) => p.species),
          r.result,
        )
      else faced.leaveOut('noOpponentTeam')

      for (const game of r.games) {
        if (!game.result) {
          for (const table of [leadPairs, leads, brought]) table.leaveOut('noResult')
          continue
        }
        const [first, second] = [...game.leads].sort()
        if (!first) leadPairs.leaveOut('noLeads')
        else if (!second) leadPairs.leaveOut('oneLead')
        else leadPairs.count([[first, second]], game.result)
        if (game.leads.length) leads.count(game.leads, game.result)
        else leads.leaveOut('noLeads')
        if (game.brought.length) brought.count(game.brought, game.result)
        else brought.leaveOut('noBrought')
      }
    }
  }

  return {
    speciesFaced: faced.read(),
    leadPairs: leadPairs.read(),
    leads: leads.read(),
    brought: brought.read(),
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
