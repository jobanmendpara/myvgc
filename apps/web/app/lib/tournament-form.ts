import { regulationOn, type TournamentView } from '@myvgc/core/schema'
import type { TournamentFormValues } from '@/components/TournamentForm.vue'

/** Today on this device, as a calendar day. */
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** A blank form for a Tournament starting today. */
export function blankTournament(): TournamentFormValues {
  const startDate = localToday()
  return {
    name: '',
    startDate,
    endDate: '',
    eventTier: 'grassroots',
    online: false,
    regulation: regulationOn(startDate),
    defaultBestOf: 1,
    location: '',
    notes: '',
  }
}

/** The form for an existing Tournament. */
export function tournamentToForm(t: TournamentView): TournamentFormValues {
  return {
    name: t.name,
    startDate: t.startDate,
    endDate: t.endDate ?? '',
    eventTier: t.eventTier,
    online: t.online,
    regulation: t.regulation,
    defaultBestOf: t.defaultBestOf,
    location: t.location ?? '',
    notes: t.notes,
  }
}

/** What the API takes from the form. Blank optional fields are sent as "not given". */
export function formToBody(values: TournamentFormValues) {
  return { ...values, endDate: values.endDate || null, location: values.location || null }
}
