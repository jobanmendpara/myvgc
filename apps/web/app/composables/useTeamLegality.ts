import type { Legality } from '@myvgc/core/schema'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { refDebounced, useOnline } from '@vueuse/core'
import { type TeamDraft, draftToLegalityCheck } from '@/lib/team-form'

const SETTLE_MS = 300

/**
 * The Team builder's live legality: the API judges the form as it stands, because the web app
 * can't load the rules (ADR 18). `legality` is undefined until a slot has a species, or while the
 * API can't answer. Then `checkedOnSync` says so: a Team built with no signal is checked by the
 * server when it is sent (ADR 17).
 */
export function useTeamLegality(draft: TeamDraft) {
  const check = refDebounced(
    computed(() => draftToLegalityCheck(draft)),
    SETTLE_MS,
  )
  const online = useOnline()
  const hasSpecies = computed(() => check.value.pokemon.some((build) => build.species))
  const query = useQuery({
    queryKey: computed(() => ['team-legality', check.value]),
    queryFn: () => $fetch<Legality>('/api/teams/check', { method: 'POST', body: check.value }),
    enabled: hasSpecies,
    placeholderData: keepPreviousData,
    retry: false,
  })
  // `online` is only a hint: a check that couldn't get an answer says the same.
  const unreachable = computed(() => !online.value || query.isError.value)
  return {
    legality: computed(() =>
      hasSpecies.value && !unreachable.value ? query.data.value : undefined,
    ),
    checkedOnSync: computed(() => hasSpecies.value && unreachable.value),
  }
}
