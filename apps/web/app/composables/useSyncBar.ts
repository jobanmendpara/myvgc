import { useOnline } from '@vueuse/core'
import { syncBar, waitingWrites } from '@/lib/outbox-view'

/** How long the bar says "All N changes sent" once everything waiting has gone. */
const SENT_SHOWN_FOR = 3_000

/**
 * The bar at the bottom of the screen (DEV-167): what it says for the outbox's state, and whether
 * the device is offline. It counts the waiting changes that get sent, so once they all have it
 * can say so for a moment. Used once, by the default layout.
 */
export function useSyncBar() {
  const { $outbox } = useNuxtApp()
  const { state } = useOutbox()
  const online = useOnline()
  const sent = ref(0)

  // The changes the User has seen waiting; only those count as sent, so a change that goes
  // straight through shows nothing.
  const seen = new Set<string>()
  watch(
    () => waitingWrites(state.value),
    (writes) => writes.forEach((write) => seen.add(write.id)),
    { immediate: true },
  )
  const stop = $outbox.subscribe((event) => {
    if (event.type === 'withdrawn') for (const write of event.writes) seen.delete(write.id)
    if (event.type !== 'attempted' || !seen.has(event.write.id)) return
    const { outcome } = event.settlement
    if (outcome === 'done') sent.value++
    // A refusal is what the bar says next; the ones sent before it go unmentioned.
    if (outcome === 'rejected') sent.value = 0
    if (outcome === 'done' || outcome === 'rejected') seen.delete(event.write.id)
  })
  onScopeDispose(stop)

  const bar = computed(() => syncBar(state.value, { online: online.value, sent: sent.value }))
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(
    () => bar.value?.kind,
    (kind) => {
      clearTimeout(timer)
      if (kind === 'sent') timer = setTimeout(() => (sent.value = 0), SENT_SHOWN_FOR)
    },
  )
  onScopeDispose(() => clearTimeout(timer))

  return { bar, online }
}

const sheetOpen = ref(false)

/** Whether the list of changes on this phone is open, from the bar or a row marked Not saved. */
export const useChangesSheet = () => sheetOpen
