import { DEFAULT_LIST_STYLES, type ListStyle, type ListStyles } from '@myvgc/core/schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useOnline } from '@vueuse/core'

const QUERY_KEY = ['account', 'list-styles']

/**
 * The List style of one list, an Account setting (DEV-80). Offline the cached style still
 * applies, but changing it needs a connection, like the Player details (ADR 17): nothing is
 * queued.
 */
export function useListStyle(list: keyof ListStyles) {
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => $fetch<ListStyles>('/api/account/list-styles'),
  })

  // Undefined until the style is known, so a list never draws in the wrong style first. If it
  // can't be loaded at all, the list gets the default rather than waiting for ever.
  const style = computed<ListStyle | undefined>(() =>
    query.data.value
      ? query.data.value[list]
      : query.isError.value
        ? DEFAULT_LIST_STYLES[list]
        : undefined,
  )

  const online = useOnline()
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: (body: ListStyles) =>
      $fetch<ListStyles>('/api/account/list-styles', { method: 'PUT', body }),
    // Online only: say so now, rather than saving whenever a signal returns.
    networkMode: 'always',
    // Restyle at once; go back to what was saved if the server refuses.
    onMutate: (body) => {
      const previous = queryClient.getQueryData<ListStyles>(QUERY_KEY)
      queryClient.setQueryData(QUERY_KEY, body)
      return { previous }
    },
    onError: (_error, _body, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous)
    },
    onSuccess: (saved) => queryClient.setQueryData(QUERY_KEY, saved),
  })

  function setStyle(value: ListStyle | undefined) {
    const current = queryClient.getQueryData<ListStyles>(QUERY_KEY)
    if (!value || !online.value || !current || current[list] === value) return
    save.mutate({ ...current, [list]: value })
  }

  return {
    style,
    /** Whether the User can change the style now: online, with the saved styles loaded. */
    changeable: computed(() => online.value && Boolean(query.data.value)),
    online,
    failed: computed(() => Boolean(save.error.value)),
    setStyle,
  }
}
