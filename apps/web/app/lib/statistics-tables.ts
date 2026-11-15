// The Statistics page's tables, in the order it shows them. To add a statistic, add it here.
import {
  type BringRateRow,
  type Counted,
  type Rate,
  type SideStatistics,
  type Statistics,
  describeCoverage,
  formatRecord,
} from '@myvgc/core/schema'

/** A row of a Statistics table, whatever the table measures. */
export interface StatisticsTableRow {
  key: string
  name: string
  played: number
  /** What the third column sorts by: the wins, or the Games the species was Brought in. */
  outcome: number
  /** What the third column shows, such as "2-1-0" or "3". */
  outcomeLabel: string
  /** The win rate or bring rate. */
  rate: number | null
  /** The Rounds or Games the row counts. */
  counted: Counted[]
}

/** A Statistics table, ready to show. */
export interface StatisticsTableView {
  title: string
  /** What the sample counts: Rounds or Games. */
  unit: 'Rounds' | 'Games'
  /** The column headings after the sample size's, such as Leads, W-L-T and Win rate. */
  headings: { name: string; outcome: string; rate: string }
  rows: StatisticsTableRow[]
  coverage: string
}

/** What a table's rows measure, and how its last two columns show it. */
interface Measure<R> {
  outcome: string
  rate: string
  read: (row: R) => Pick<StatisticsTableRow, 'outcome' | 'outcomeLabel' | 'rate'>
}

/** The User's record and win rate, as most tables show. */
const WIN_RATE: Measure<Rate> = {
  outcome: 'W-L-T',
  rate: 'Win rate',
  read: (row) => ({ outcome: row.wins, outcomeLabel: formatRecord(row), rate: row.winRate }),
}

/** How often a species on an Opponent's Team was Brought. */
const BRING_RATE: Measure<BringRateRow> = {
  outcome: 'Brought',
  rate: 'Bring rate',
  read: (row) => ({ outcome: row.brought, outcomeLabel: String(row.brought), rate: row.bringRate }),
}

type Row = { species: string | string[]; played: number; counted: Counted[] }
type Table<R> = { rows: (R & Row)[]; coverage: Parameters<typeof describeCoverage>[0] }
type Definition = (stats: Statistics, speciesName: (id: string) => string) => StatisticsTableView

/** A table read from the Statistics endpoint's answer. A Lead pair is named by both species. */
function table<R>(
  title: string,
  unit: StatisticsTableView['unit'],
  nameHeading: string,
  measure: Measure<R>,
  pick: (stats: Statistics) => Table<R>,
): Definition {
  return (stats, speciesName) => {
    const { rows, coverage } = pick(stats)
    return {
      title,
      unit,
      headings: { name: nameHeading, outcome: measure.outcome, rate: measure.rate },
      rows: rows.map((row) => {
        const species = [row.species].flat()
        return {
          key: species.join(' '),
          name: species.map(speciesName).join(' + '),
          played: row.played,
          counted: row.counted,
          ...measure.read(row),
        }
      }),
      coverage: describeCoverage(coverage, unit),
    }
  }
}

const SIDES = { user: 'Your', opponent: 'Opponent’s' } as const

/** A table counted for each side of the Games: the User's, then the Opponent's beside it. */
const bothSides = (title: string, nameHeading: string, key: keyof SideStatistics) =>
  (Object.keys(SIDES) as (keyof typeof SIDES)[]).map((side) =>
    table(`${SIDES[side]} ${title}`, 'Games', nameHeading, WIN_RATE, (stats) => stats[side][key]),
  )

// Shown two to a row on wide screens, so each row pairs the User's side with the Opponent's.
const TABLES: Definition[] = [
  table('Species faced', 'Rounds', 'Species', WIN_RATE, (s) => s.speciesFaced),
  table('Brought from Opponent’s Teams', 'Games', 'Species', BRING_RATE, (s) => s.bringRates),
  ...bothSides('Brought Pokémon', 'Species', 'brought'),
  ...bothSides('Lead pairs', 'Leads', 'leadPairs'),
  ...bothSides('single Leads', 'Lead', 'leads'),
]

/** The Statistics page's tables, with species named by `speciesName`. */
export const statisticsTables = (stats: Statistics, speciesName: (id: string) => string) =>
  TABLES.map((definition) => definition(stats, speciesName))
