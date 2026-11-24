import type { TeamView } from '@myvgc/core/schema'
import { useQuery } from '@tanstack/vue-query'
import { FetchError } from 'ofetch'
import { teamNotYetCreated } from '@/lib/outbox-view'

/**
 * One of the User's Teams, and whether it turned out not to exist. A Team built on this phone that
 * the server doesn't have yet (ADR 17) still exists: the outbox gives its page.
 */
export function useTeam(id: Ref<string>) {
  const { state } = useOutbox()
  const query = useQuery({
    queryKey: computed(() => ['team', id.value]),
    queryFn: () => $fetch<TeamView>(`/api/teams/${id.value}`),
    retry: (count, error) =>
      !(error instanceof FetchError && error.statusCode === 404) && count < 1,
  })
  const notFound = computed(
    () =>
      query.error.value instanceof FetchError &&
      query.error.value.statusCode === 404 &&
      !teamNotYetCreated(state.value, id.value),
  )
  return { query, team: query.data, notFound }
}
