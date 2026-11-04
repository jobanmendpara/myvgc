import type { Regulation, RegulationPeriod, Season } from '@myvgc/core/schema'
import { useQuery } from '@tanstack/vue-query'

export interface Calendar {
  today: string
  currentRegulation: Regulation
  regulations: RegulationPeriod[]
  seasons: Season[]
}

/** Seasons and Regulation dates from the server, with the server's idea of today (ADR 16). */
export function useCalendar() {
  return useQuery({
    queryKey: ['calendar'],
    queryFn: () => $fetch<Calendar>('/api/calendar'),
    staleTime: 60 * 60 * 1000,
  })
}
