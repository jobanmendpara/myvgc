import { saveChange, type WriteDraft } from '@/lib/outbox'

/**
 * The outbox of changes kept on this device until the server has them (ADR 17): its state, for
 * the page to show, and what the User can do with a write. `save` is how the pages that work
 * offline save a Round, an Opponent or a Note entry.
 */
export function useOutbox() {
  const { $outbox, $outboxState } = useNuxtApp()
  return {
    /** The pending writes, the rejected ones with the server's message, and any wait for login. */
    state: $outboxState,
    /** How many changes on this device the server doesn't have yet, rejected ones included. */
    unsynced: computed(
      () => $outboxState.value.pending.length + $outboxState.value.rejected.length,
    ),
    save: (draft: WriteDraft) => saveChange($outbox, draft),
    discard: (id: string) => $outbox.discard(id),
    retry: (id: string) => $outbox.retry(id),
  }
}
