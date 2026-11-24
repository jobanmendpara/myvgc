import type { TournamentView } from '@myvgc/core/schema'
import { useQuery } from '@tanstack/vue-query'
import { FetchError } from 'ofetch'
import { notYetCreated } from '@/lib/outbox-view'

/**
 * One Tournament with its Rounds, and whether it turned out not to exist. A Tournament created on
 * this phone that the server doesn't have yet (ADR 17) still exists: the outbox gives its page.
 */
export function useTournament(id: Ref<string>) {
  const { state } = useOutbox()
  const query = useQuery({
    queryKey: computed(() => ['tournament', id.value]),
    queryFn: () => $fetch<TournamentView>(`/api/tournaments/${id.value}`),
    retry: (count, error) =>
      !(error instanceof FetchError && error.statusCode === 404) && count < 1,
  })
  const notFound = computed(
    () =>
      query.error.value instanceof FetchError &&
      query.error.value.statusCode === 404 &&
      !notYetCreated(state.value, id.value),
  )
  return { query, tournament: query.data, notFound }
}
