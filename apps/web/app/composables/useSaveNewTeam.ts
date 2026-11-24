import type { TeamBody } from '@myvgc/core/schema'
import { useQueryClient } from '@tanstack/vue-query'
import type { CreatedTeam } from '@/lib/api'
import { addTeam } from '@/lib/outbox-writes'

/**
 * How the Team builder saves a new Team, built by hand or read from a file and checked by the
 * User: kept on the phone first, so it works with no signal too, and sent when it can be (ADR 17).
 * Its ID is chosen here, so its page opens at once. Gives that ID.
 */
export function useSaveNewTeam() {
  const outbox = useOutbox()
  const names = useChampionsNames()
  const queryClient = useQueryClient()
  return async (body: TeamBody) => {
    const draft = addTeam(body, names.data.value)
    const saved = await outbox.save(draft)
    // The server's Team, judged, in place of the one this phone showed.
    if (saved.sent)
      queryClient.setQueryData(['team', draft.subject.teamId], (saved.body as CreatedTeam).team)
    return draft.subject.teamId!
  }
}
