import type { Query, QueryClient } from '@tanstack/vue-query'
import { acrossTabs, deviceOutboxStore, Outbox, sendRequest } from '@/lib/outbox'
import { addedTournament, applyPending, isOutboxTarget, revertWrite } from '@/lib/outbox-apply'
import { type OutboxWrite, worthTrying } from '@/lib/outbox-rules'
import { watchOutboxTriggers } from '@/lib/outbox-triggers'

// The outbox (ADR 17), and what it does to the cached pages: each pending write shows at once,
// stays shown over every answer from the server until it is sent, and the server's answer
// replaces it once it is. The auth middleware opens it for the User the app opens as.

/** The cached queries a write changes, to ask the server for again once it is settled. */
function staleAfter(write: OutboxWrite): unknown[][] {
  const { tournamentId, opponentId } = write.subject
  switch (write.kind) {
    case 'log-round':
    case 'edit-round':
    case 'delete-round':
    case 'delete-tournament':
      return [
        ['tournament', tournamentId],
        ['tournaments'],
        ['opponents'],
        ['dashboard'],
        ['statistics'],
      ]
    case 'add-tournament':
    case 'edit-tournament':
    case 'link-tournament-team':
    case 'unlink-tournament-team':
      return [['tournament', tournamentId], ['tournaments'], ['dashboard'], ['statistics']]
    case 'add-opponent':
    case 'delete-opponent':
      return [['opponents']]
    case 'edit-opponent':
      // The Rounds against them show their display name.
      return [['opponents'], ['tournament']]
    case 'save-player-details':
      return [['account', 'player-details']]
    case 'save-list-styles':
      return [['account', 'list-styles']]
    default:
      return [['opponents', 'detail', opponentId]]
  }
}

/**
 * Every Opponent a write adds, whose page is needed before the server has them: added with a
 * Round while it waits, or on their own, also while the server refuses them, so they can be fixed.
 */
function addedOpponentIds(writes: readonly OutboxWrite[]) {
  return writes.flatMap((write) => {
    const body = (write.request.body ?? {}) as { id?: string; newOpponentId?: string }
    if (write.kind === 'add-opponent' && body.id) return [body.id]
    if (write.state.status !== 'pending') return []
    if (write.kind === 'log-round' && body.newOpponentId) return [body.newOpponentId]
    return []
  })
}

/** Every Tournament created on this device, whose page is needed before the server has it. */
const addedTournamentIds = (writes: readonly OutboxWrite[]) =>
  writes.flatMap((write) => addedTournament(write)?.id ?? [])

function connect(outbox: Outbox, queryClient: QueryClient) {
  const cache = queryClient.getQueryCache()
  const targets = () => cache.getAll().filter((query) => isOutboxTarget(query.queryKey))
  // The dashboard is worked out again from the Tournaments list while writes on them wait.
  const context = () => ({ tournaments: queryClient.getQueryData(['tournaments']) })

  /** Sets a query's data, keeping it marked for asking the server again if it was. */
  function replace(query: Query, data: unknown) {
    if (data === query.state.data) return
    const invalid = query.state.isInvalidated
    queryClient.setQueryData(query.queryKey, data)
    if (invalid)
      void queryClient.invalidateQueries({
        queryKey: query.queryKey,
        exact: true,
        refetchType: 'none',
      })
  }

  function applyAll() {
    const writes = outbox.writes
    for (const query of targets()) {
      if (query.state.data === undefined) continue
      replace(query, applyPending(query.queryKey, query.state.data, writes, context()))
    }
    const seeded = [
      ...addedOpponentIds(writes).map((id) => ['opponents', 'detail', id]),
      ...addedTournamentIds(writes).map((id) => ['tournament', id]),
    ]
    for (const key of seeded)
      if (queryClient.getQueryData(key) === undefined)
        queryClient.setQueryData(key, applyPending(key, undefined, writes))
  }

  function refetch(write: OutboxWrite) {
    for (const queryKey of staleAfter(write)) void queryClient.invalidateQueries({ queryKey })
  }

  outbox.subscribe((event) => {
    if (event.type === 'changed') applyAll()
    if (event.type === 'attempted' && event.settlement.outcome === 'done') refetch(event.write)
    if (event.type === 'withdrawn') {
      // Taken back out of the pages, which then ask the server for what it has.
      for (const write of event.writes) {
        for (const query of targets()) {
          const data = query.state.data
          if (data !== undefined) replace(query, revertWrite(query.queryKey, data, write))
        }
      }
      applyAll()
      // A new Tournament discarded from this phone never existed: its page goes too.
      const kept = new Set(addedTournamentIds(outbox.writes))
      for (const id of addedTournamentIds(event.writes))
        if (!kept.has(id)) queryClient.removeQueries({ queryKey: ['tournament', id], exact: true })
      // So does a new Opponent's, once nothing on this phone adds them any more.
      const stillAdded = new Set(addedOpponentIds(outbox.writes))
      for (const write of event.writes) {
        const id = write.kind === 'add-opponent' ? write.subject.opponentId : undefined
        if (id && !stillAdded.has(id) && !outbox.writes.some((w) => w.id === write.id))
          queryClient.removeQueries({ queryKey: ['opponents', 'detail', id], exact: true })
      }
      for (const write of event.writes) refetch(write)
    }
  })

  // An answer from the server doesn't have the writes still pending: put them back on top.
  cache.subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success' || event.action.manual) return
    const { queryKey } = event.query
    if (!isOutboxTarget(queryKey) || !outbox.state.pending.length) return
    queryClient.setQueryData(
      queryKey,
      applyPending(queryKey, event.action.data, outbox.writes, context()),
    )
  })
}

export default defineNuxtPlugin({
  name: 'outbox',
  dependsOn: ['vue-query'],
  setup(nuxtApp) {
    const outbox = new Outbox({
      store: deviceOutboxStore(),
      send: sendRequest,
      exclusive: acrossTabs,
    })
    const outboxState = shallowRef(outbox.state)
    outbox.subscribe((event) => {
      if (event.type === 'changed' || event.type === 'progress') outboxState.value = event.state
    })
    connect(outbox, nuxtApp.$queryClient)
    watchOutboxTriggers({
      tryNow: () => void outbox.flush(),
      hasPending: () => worthTrying(outbox.state),
    })
    // Read-only for the page: only the outbox changes it.
    return { provide: { outbox, outboxState: computed(() => outboxState.value) } }
  },
})
