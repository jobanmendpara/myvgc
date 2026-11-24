import type { Query, QueryClient } from '@tanstack/vue-query'
import { acrossTabs, deviceOutboxStore, Outbox, sendRequest } from '@/lib/outbox'
import { applyPending, isOutboxTarget, revertWrite } from '@/lib/outbox-apply'
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
      return [['tournament', tournamentId], ['tournaments'], ['opponents']]
    case 'add-opponent':
      return [['opponents']]
    default:
      return [['opponents', 'detail', opponentId]]
  }
}

/** Every Opponent a pending write adds, whose page is needed before the server has them. */
function addedOpponentIds(writes: readonly OutboxWrite[]) {
  return writes.flatMap((write) => {
    const body = (write.request.body ?? {}) as { id?: string; newOpponentId?: string }
    if (write.state.status !== 'pending') return []
    if (write.kind === 'add-opponent' && body.id) return [body.id]
    if (write.kind === 'log-round' && body.newOpponentId) return [body.newOpponentId]
    return []
  })
}

function connect(outbox: Outbox, queryClient: QueryClient) {
  const cache = queryClient.getQueryCache()
  const targets = () => cache.getAll().filter((query) => isOutboxTarget(query.queryKey))

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
      replace(query, applyPending(query.queryKey, query.state.data, writes))
    }
    for (const id of addedOpponentIds(writes)) {
      const key = ['opponents', 'detail', id]
      if (queryClient.getQueryData(key) === undefined)
        queryClient.setQueryData(key, applyPending(key, undefined, writes))
    }
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
      for (const write of event.writes) refetch(write)
    }
  })

  // An answer from the server doesn't have the writes still pending: put them back on top.
  cache.subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success' || event.action.manual) return
    const { queryKey } = event.query
    if (!isOutboxTarget(queryKey) || !outbox.state.pending.length) return
    queryClient.setQueryData(queryKey, applyPending(queryKey, event.action.data, outbox.writes))
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
