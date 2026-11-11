import { useEventListener } from '@vueuse/core'
import { type Ref, defineComponent, h } from 'vue'
import DiscardChangesDialog from '@/components/DiscardChangesDialog.vue'

// Every form on the page with unsaved edits, so logging out can ask before it ends the session.
const askers = new Set<() => Promise<boolean>>()

/** Asks each form with unsaved edits whether to discard them. False if the User keeps editing. */
export async function confirmDiscardAll(): Promise<boolean> {
  for (const ask of askers) {
    if (!(await ask())) return false
  }
  return true
}

/**
 * Asks before leaving with unsaved edits: on a route change (also to another item on the same
 * page), on log out and on closing the tab.
 * Render the returned `DiscardDialog` once in the form's template; it asks "Discard changes?"
 * about `subject`, a fixed phrase such as "this Tournament".
 */
export function useDiscardGuard(dirty: Ref<boolean>, subject: string) {
  const discarding = ref(false)
  // Set once the User chooses to discard, so leaving afterwards doesn't ask again.
  const discarded = ref(false)
  let answerDiscard: ((leave: boolean) => void) | undefined

  async function ask(): Promise<boolean> {
    if (!dirty.value || discarded.value) return true
    discarding.value = true
    const leave = await new Promise<boolean>((resolve) => (answerDiscard = resolve))
    discarded.value = leave
    return leave
  }

  function answer(leave: boolean) {
    discarding.value = false
    answerDiscard?.(leave)
    answerDiscard = undefined
  }

  onBeforeRouteLeave(ask)
  // The same route with other params, such as another item clicked in a list column. A change to
  // the query alone doesn't leave the page.
  onBeforeRouteUpdate((to, from) => (to.path === from.path ? true : ask()))
  askers.add(ask)
  onUnmounted(() => askers.delete(ask))
  useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent) => {
    if (dirty.value && !discarded.value) event.preventDefault()
  })

  const DiscardDialog = defineComponent(
    () => () => h(DiscardChangesDialog, { open: discarding.value, subject, onAnswer: answer }),
    { name: 'DiscardDialog' },
  )

  return { DiscardDialog }
}
