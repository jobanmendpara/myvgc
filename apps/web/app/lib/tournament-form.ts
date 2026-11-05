import {
  type NewTournament,
  type TournamentView,
  fromMinorUnits,
  regulationOn,
  toMinorUnits,
  today,
} from '@myvgc/core/schema'
import type { TournamentFormValues } from '@/components/TournamentForm.vue'

/** A blank form for a Tournament starting today, with the currency the User used last. */
export function blankTournament(lastCurrency = ''): TournamentFormValues {
  const startDate = today()
  return {
    name: '',
    startDate,
    endDate: '',
    eventTier: 'grassroots',
    online: false,
    regulation: regulationOn(startDate),
    defaultBestOf: 1,
    location: '',
    organizer: '',
    entryFeeAmount: '',
    entryFeeCurrency: lastCurrency,
    championshipPoints: '',
    playerCount: '',
    link: '',
    placement: '',
    dropped: false,
    notes: '',
  }
}

/** The currency on the User's most recently created Tournament with an Entry fee. */
export function lastCurrency(tournaments: TournamentView[] | undefined): string {
  const withFee = (tournaments ?? []).filter((t) => t.entryFee)
  withFee.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return withFee[0]?.entryFee?.currency ?? ''
}

/** The form for an existing Tournament. */
export function tournamentToForm(t: TournamentView): TournamentFormValues {
  const count = (n: number | null) => (n === null ? '' : String(n))
  return {
    name: t.name,
    startDate: t.startDate,
    endDate: t.endDate ?? '',
    eventTier: t.eventTier,
    online: t.online,
    regulation: t.regulation,
    defaultBestOf: t.defaultBestOf,
    location: t.location ?? '',
    organizer: t.organizer ?? '',
    entryFeeAmount: t.entryFee ? fromMinorUnits(t.entryFee.amount, t.entryFee.currency) : '',
    entryFeeCurrency: t.entryFee?.currency ?? '',
    championshipPoints: count(t.championshipPoints),
    playerCount: count(t.playerCount),
    link: t.link ?? '',
    placement: count(t.placement),
    dropped: t.dropped,
    notes: t.notes,
  }
}

/** A whole Tournament as the API takes it, for creating one or saving every field. */
export type TournamentBody = Required<Omit<NewTournament, 'id' | 'regulation'>> &
  Pick<NewTournament, 'regulation'>

/**
 * What the API takes from the form. Blank optional fields are sent as "not given"; amounts and
 * counts that aren't numbers are reported here, against their field.
 */
export function formToBody(
  values: TournamentFormValues,
): { ok: true; body: TournamentBody } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const count = (field: keyof TournamentFormValues, text: string) => {
    if (!text.trim()) return null
    if (/^\s*\d+\s*$/.test(text)) return Number(text)
    errors[field] = 'Use a whole number.'
    return null
  }

  let entryFee: TournamentBody['entryFee'] = null
  const currency = values.entryFeeCurrency.trim().toUpperCase()
  if (values.entryFeeAmount.trim()) {
    if (!/^[A-Z]{3}$/.test(currency)) {
      errors['entryFee.currency'] = 'Choose the currency you paid in, such as USD.'
    } else {
      const amount = toMinorUnits(values.entryFeeAmount, currency)
      if (amount === undefined) errors['entryFee.amount'] = 'Use an amount such as 25.00.'
      else entryFee = { amount, currency }
    }
  }

  const body: TournamentBody = {
    name: values.name,
    startDate: values.startDate,
    endDate: values.endDate || null,
    eventTier: values.eventTier,
    online: values.online,
    regulation: values.regulation,
    defaultBestOf: values.defaultBestOf,
    location: values.location || null,
    organizer: values.organizer || null,
    entryFee,
    championshipPoints: count('championshipPoints', values.championshipPoints),
    playerCount: count('playerCount', values.playerCount),
    link: values.link || null,
    placement: count('placement', values.placement),
    dropped: values.dropped,
    notes: values.notes,
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, body }
}
