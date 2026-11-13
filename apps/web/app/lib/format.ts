// Display helpers shared by the Tournament, Opponent, dashboard and Statistics pages.
import { ROUND_RESULT_LABELS, TOP_CUT_STAGE_LABELS, type RoundView } from '@myvgc/core/schema'

/** A Round's place in its Tournament, such as "Round 3" or "Top 8". */
export const roundLabel = (r: Pick<RoundView, 'phase' | 'roundNumber' | 'stage'>) =>
  r.phase === 'swiss' ? `Round ${r.roundNumber}` : TOP_CUT_STAGE_LABELS[r.stage!]

/** A Round's result, with its Game score when there is one, such as "Win 2-1". */
export const roundOutcome = (r: Pick<RoundView, 'result' | 'gameScore'>) =>
  r.gameScore
    ? `${ROUND_RESULT_LABELS[r.result]} ${r.gameScore.won}-${r.gameScore.lost}`
    : ROUND_RESULT_LABELS[r.result]

const dayMonthYear = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const dayMonth = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

// Calendar days have no time zone, so they are read and written as UTC to stay on the same day.
const asDate = (day: string) => new Date(`${day}T00:00:00Z`)

/** A Tournament's dates, such as "19 Sept 2026" or "19 Sept – 20 Sept 2026". */
export function formatDates(start: string, end?: string | null): string {
  if (!end || end === start) return dayMonthYear.format(asDate(start))
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  const from = sameYear ? dayMonth.format(asDate(start)) : dayMonthYear.format(asDate(start))
  return `${from} – ${dayMonthYear.format(asDate(end))}`
}

/** 1 → "1st", 22 → "22nd", 13 → "13th". */
export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}

/** A rate as a whole percentage, such as "67%", or a dash when there is none. */
export const percent = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`)
