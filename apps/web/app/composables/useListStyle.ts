import { DEFAULT_LIST_STYLES, type ListStyle, type ListStyles } from '@myvgc/core/schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { saveListStyles } from '@/lib/outbox-writes'

const QUERY_KEY = ['account', 'list-styles']

/**
 * The List style of one list, an Account setting (DEV-80). A change is kept on the phone first
 * and sent when it can be (ADR 17, DEV-205), so it also works with no signal: the outbox restyles
 * the list at once.
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

  const outbox = useOutbox()
  const queryClient = useQueryClient()
  const save = useMutation({
    // Runs with no signal too, as the outbox keeps the change (ADR 17).
    networkMode: 'always',
    mutationFn: ({ styles, before }: { styles: ListStyles; before: ListStyles }) =>
      outbox.save(saveListStyles(styles, before)),
  })

  function setStyle(value: ListStyle | undefined) {
    const current = queryClient.getQueryData<ListStyles>(QUERY_KEY)
    if (!value || !current || current[list] === value) return
    save.mutate({ styles: { ...current, [list]: value }, before: current })
  }

  return {
    style,
    /** Whether the User can change the style now: with the saved styles loaded. */
    changeable: computed(() => Boolean(query.data.value)),
    failed: computed(() => Boolean(save.error.value)),
    setStyle,
  }
}
