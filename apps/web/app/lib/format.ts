// Display helpers shared by the Tournament, Opponent and dashboard pages.

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
