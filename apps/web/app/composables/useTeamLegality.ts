import type { Legality } from '@myvgc/core/schema'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { refDebounced } from '@vueuse/core'
import { type TeamDraft, draftToLegalityCheck } from '@/lib/team-form'

const SETTLE_MS = 300

/**
 * The Team builder's live legality: the API judges the form as it stands, because the web app
 * can't load the rules (ADR 18). Undefined until a slot has a species, or while the API can't
 * answer: Team building is online only, and saving will say so (ADR 17).
 */
export function useTeamLegality(draft: TeamDraft) {
  const check = refDebounced(
    computed(() => draftToLegalityCheck(draft)),
    SETTLE_MS,
  )
  const hasSpecies = computed(() => check.value.pokemon.some((build) => build.species))
  const query = useQuery({
    queryKey: computed(() => ['team-legality', check.value]),
    queryFn: () => $fetch<Legality>('/api/teams/check', { method: 'POST', body: check.value }),
    enabled: hasSpecies,
    placeholderData: keepPreviousData,
    retry: false,
  })
  return computed(() => (hasSpecies.value ? query.data.value : undefined))
}
