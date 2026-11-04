import type { TournamentView } from '@myvgc/core/schema'
import { useQuery } from '@tanstack/vue-query'
import { FetchError } from 'ofetch'

/** One Tournament with its Rounds, and whether it turned out not to exist. */
export function useTournament(id: Ref<string>) {
  const query = useQuery({
    queryKey: computed(() => ['tournament', id.value]),
    queryFn: () => $fetch<TournamentView>(`/api/tournaments/${id.value}`),
    retry: (count, error) =>
      !(error instanceof FetchError && error.statusCode === 404) && count < 1,
  })
  const notFound = computed(
    () => query.error.value instanceof FetchError && query.error.value.statusCode === 404,
  )
  return { query, tournament: query.data, notFound }
}
