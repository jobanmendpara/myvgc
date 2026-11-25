import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDeviceDatabase, deviceStore } from '../app/lib/device-database'
import {
  deviceOutboxStore,
  Outbox,
  type OutboxEvent,
  RejectedChange,
  saveChange,
  type WriteDraft,
} from '../app/lib/outbox'
import {
  type Answer,
  discardedWith,
  nextWrite,
  OLD_FORMAT_MESSAGE,
  OUTBOX_FORMAT,
  type OutboxWrite,
  settle,
  type WriteRequest,
} from '../app/lib/outbox-rules'

const ASH = 'user-ash'
const MISTY = 'user-misty'

let count = 0
/** A write on a Tournament's Rounds, or on an Opponent's Note entries. */
function draft(series: string, method: WriteRequest['method'] = 'POST', id = `w${++count}`) {
  return {
    id,
    kind: 'log-round',
    request: { method, url: `/api/${series}/${id}`, body: { id } },
    series: [series],
    subject: {},
    label: id,
  } satisfies WriteDraft
}

/** A server that answers each URL as told, and records what it was sent. */
function fakeServer() {
  const sent: string[] = []
  const answers = new Map<string, Answer[]>()
  let fallback: Answer = { status: 200, body: {} }
  return {
    sent,
    answer(url: string, ...list: Answer[]) {
      answers.set(url, list)
    },
    answerAll(answer: Answer) {
      fallback = answer
    },
    send: async (request: WriteRequest): Promise<Answer> => {
      sent.push(request.url)
      return answers.get(request.url)?.shift() ?? fallback
    },
  }
}

let server: ReturnType<typeof fakeServer>
let clock = 1_000

let outboxes: Outbox[] = []
function newOutbox() {
  const outbox = new Outbox({ store: deviceOutboxStore(), send: server.send, now: () => clock++ })
  outboxes.push(outbox)
  return outbox
}

/** Opens a User's outbox and waits for the pass that opening starts. */
async function open(outbox: Outbox, userId: string) {
  await outbox.open(userId)
  await outbox.flush()
}

beforeEach(async () => {
  await closeDeviceDatabase()
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('IDBKeyRange', IDBKeyRange)
  server = fakeServer()
})

afterEach(async () => {
  // Let every pass finish before the next test's database replaces this one.
  await Promise.all(outboxes.map((outbox) => outbox.flush()))
  outboxes = []
  await closeDeviceDatabase()
  vi.unstubAllGlobals()
})

describe('Settling an answer (ADR 17)', () => {
  const post = { request: { method: 'POST', url: '/api/x' } } as const
  const patch = { request: { method: 'PATCH', url: '/api/x' } } as const
  const del = { request: { method: 'DELETE', url: '/api/x' } } as const

  it('is done on any 2xx', () => {
    expect(settle(post, { status: 201, body: { id: 'r1' } })).toEqual({
      outcome: 'done',
      body: { id: 'r1' },
    })
    expect(settle(del, { status: 204 })).toMatchObject({ outcome: 'done' })
  })

  it('is done on a 404 for an edit or delete, as nothing is left to change', () => {
    expect(settle(patch, { status: 404 })).toMatchObject({ outcome: 'done' })
    expect(settle(del, { status: 404 })).toMatchObject({ outcome: 'done' })
  })

  it('rejects a create whose Tournament or Opponent is gone', () => {
    expect(settle(post, { status: 404 })).toMatchObject({ outcome: 'rejected', status: 404 })
  })

  it('rejects a 400 or 409, keeping the server message and the field', () => {
    expect(
      settle(post, {
        status: 409,
        body: { error: 'Round 3 is already logged.', fields: { roundNumber: 'Round 3 is…' } },
      }),
    ).toEqual({
      outcome: 'rejected',
      status: 409,
      message: 'Round 3 is already logged.',
      fields: { roundNumber: 'Round 3 is…' },
    })
    expect(
      settle(post, {
        status: 400,
        body: { error: 'Invalid request', fields: { opponentId: 'Choose one of your Opponents.' } },
      }),
    ).toMatchObject({ outcome: 'rejected', message: 'Choose one of your Opponents.' })
  })

  it('waits for a login on a 401', () => {
    expect(settle(post, { status: 401 })).toEqual({ outcome: 'login' })
  })

  it('retries on no answer, a timeout or a server error', () => {
    expect(settle(post, { status: 'unreachable' })).toEqual({ outcome: 'retry', unreachable: true })
    expect(settle(post, { status: 503 })).toEqual({ outcome: 'retry', unreachable: false })
    expect(settle(post, { status: 500 })).toMatchObject({ outcome: 'retry' })
    expect(settle(post, { status: 429 })).toMatchObject({ outcome: 'retry' })
  })
})

describe('Choosing the next write', () => {
  const write = (id: string, order: number, series: string[], rejected = false) =>
    ({
      id,
      order,
      series,
      state: rejected ? { status: 'rejected', message: 'No' } : { status: 'pending', attempts: 0 },
    }) as OutboxWrite

  it('takes writes in the order they were made', () => {
    const writes = [write('b', 2, ['t:1']), write('a', 1, ['t:2'])]
    expect(nextWrite(writes)?.id).toBe('a')
  })

  it('holds a write behind an earlier one in its series, but not behind other series', () => {
    const writes = [write('a', 1, ['t:1']), write('b', 2, ['t:1']), write('c', 3, ['o:1'])]
    expect(nextWrite(writes, new Set(['a']))?.id).toBe('c')
  })

  it('lets a rejected write stop holding back its series', () => {
    const writes = [write('a', 1, ['t:1'], true), write('b', 2, ['t:1'])]
    expect(nextWrite(writes)?.id).toBe('b')
  })

  it('holds back what waits on a refused create, such as the Rounds in a new Tournament', () => {
    const create = { ...write('a', 1, ['t:1'], true), creates: 't:1' }
    const writes = [create, write('b', 2, ['t:1']), write('c', 3, ['o:1'])]
    expect(nextWrite(writes)?.id).toBe('c')
    expect(nextWrite([create, write('b', 2, ['t:1', 'o:1'])])).toBeUndefined()
  })
})

describe('The outbox', () => {
  it('keeps a write on the device before it resolves, and with no expiry', async () => {
    const outbox = newOutbox()
    server.answerAll({ status: 'unreachable' })
    await open(outbox, ASH)
    await outbox.add(draft('t1'))

    await closeDeviceDatabase()
    const later = newOutbox()
    await open(later, ASH)
    expect(later.state.pending.map((w) => w.label)).toEqual([`w${count}`])
  })

  it('keeps a write made from a page’s reactive data, such as the Round being deleted', async () => {
    const outbox = newOutbox()
    server.answerAll({ status: 'unreachable' })
    await open(outbox, ASH)
    // A page's data is a Proxy, which the device's database can't keep as it is.
    const before = new Proxy({ id: 'r2', roundNumber: 2 }, {})
    await outbox.add({ ...draft('t1', 'DELETE'), subject: { roundId: 'r2', before } })

    const later = newOutbox()
    await open(later, ASH)
    expect(later.state.pending[0]?.subject.before).toEqual({ id: 'r2', roundNumber: 2 })
  })

  it('sends writes on one Tournament in series, in the order they were made', async () => {
    const outbox = newOutbox()
    await open(outbox, ASH)
    server.answerAll({ status: 'unreachable' })
    const a = await outbox.add(draft('t1'))
    const b = await outbox.add(draft('t1', 'PATCH'))
    const c = await outbox.add(draft('t1', 'DELETE'))
    await outbox.flush()
    server.sent.length = 0

    server.answerAll({ status: 200, body: {} })
    await outbox.flush()
    expect(server.sent).toEqual([a.request.url, b.request.url, c.request.url])
    expect(outbox.state.pending).toEqual([])
  })

  it('stops a pass when the server cannot be reached, and sends the rest next time', async () => {
    const outbox = newOutbox()
    await open(outbox, ASH)
    server.answerAll({ status: 'unreachable' })
    await outbox.add(draft('t1'))
    await outbox.add(draft('o1'))
    server.sent.length = 0
    await outbox.flush()
    expect(server.sent).toHaveLength(1)
    expect(outbox.state.pending.map((w) => w.state)).toEqual([
      { status: 'pending', attempts: 1 },
      { status: 'pending', attempts: 0 },
    ])
  })

  it('keeps sending other series past a server error, holding back its own', async () => {
    const outbox = newOutbox()
    await open(outbox, ASH)
    server.answerAll({ status: 'unreachable' })
    const failing = await outbox.add(draft('t1'))
    const behind = await outbox.add(draft('t1'))
    const other = await outbox.add(draft('o1'))
    server.sent.length = 0
    server.answerAll({ status: 200 })
    server.answer(failing.request.url, { status: 503 })
    await outbox.flush()
    expect(server.sent).toEqual([failing.request.url, other.request.url])
    expect(outbox.state.pending.map((w) => w.id)).toEqual([failing.id, behind.id])
  })

  it('keeps a rejected write with the server message until it is discarded or retried', async () => {
    const outbox = newOutbox()
    await open(outbox, ASH)
    server.answerAll({ status: 'unreachable' })
    const write = await outbox.add(draft('t1'))
    server.answer(write.request.url, {
      status: 409,
      body: { error: 'Round 3 is already logged.', fields: { roundNumber: 'Round 3 is…' } },
    })
    await outbox.flush()
    expect(outbox.state.rejected).toMatchObject([
      {
        id: write.id,
        state: {
          status: 'rejected',
          message: 'Round 3 is already logged.',
          fields: { roundNumber: 'Round 3 is…' },
        },
      },
    ])

    // Kept on the device too.
    const later = newOutbox()
    await open(later, ASH)
    await later.flush()
    expect(later.state.rejected.map((w) => w.id)).toEqual([write.id])

    server.answer(write.request.url, { status: 201 })
    await outbox.retry(write.id)
    await outbox.flush()
    expect(outbox.state.rejected).toEqual([])
    expect(outbox.state.pending).toEqual([])
  })

  it('discards one write without sending it', async () => {
    const outbox = newOutbox()
    await open(outbox, ASH)
    server.answerAll({ status: 'unreachable' })
    const gone = await outbox.add(draft('t1'))
    const kept = await outbox.add(draft('t1'))
    await outbox.discard(gone.id)
    expect(outbox.state.pending.map((w) => w.id)).toEqual([kept.id])
    const later = newOutbox()
    await open(later, ASH)
    expect(later.state.pending.map((w) => w.id)).toEqual([kept.id])
  })

  it('holds the whole queue on a 401 until the User logs in again', async () => {
    const outbox = newOutbox()
    await open(outbox, ASH)
    server.answerAll({ status: 'unreachable' })
    await outbox.add(draft('t1'))
    await outbox.add(draft('o1'))
    server.sent.length = 0
    server.answerAll({ status: 401 })
    await outbox.flush()
    expect(server.sent).toHaveLength(1)
    expect(outbox.state.waitingForLogin).toBe(true)

    server.answerAll({ status: 200 })
    await outbox.flush()
    expect(server.sent).toHaveLength(1)

    await open(outbox, ASH)
    await outbox.flush()
    expect(outbox.state).toEqual({ pending: [], rejected: [], waitingForLogin: false })
  })

  it('keeps each User’s writes apart, and clears only one User’s', async () => {
    const outbox = newOutbox()
    server.answerAll({ status: 'unreachable' })
    await open(outbox, ASH)
    await outbox.add(draft('t1'))
    await open(outbox, MISTY)
    expect(outbox.state.pending).toEqual([])
    await outbox.add(draft('t2'))

    await outbox.clear(MISTY)
    expect(outbox.state.pending).toEqual([])
    await open(outbox, ASH)
    expect(outbox.state.pending).toHaveLength(1)
  })

  it('shows a write kept in another format as rejected, never dropping it', async () => {
    await deviceStore('outbox').set([ASH, 5, 'old'], {
      id: 'old',
      userId: ASH,
      order: 5,
      format: OUTBOX_FORMAT + 1,
      label: 'Round 2 in Worlds',
    })
    const outbox = newOutbox()
    await open(outbox, ASH)
    await outbox.flush()
    expect(server.sent).toEqual([])
    expect(outbox.state.rejected).toMatchObject([
      { id: 'old', label: 'Round 2 in Worlds', state: { message: OLD_FORMAT_MESSAGE } },
    ])
    await outbox.retry('old')
    expect(outbox.state.rejected).toHaveLength(1)
    await outbox.discard('old')
    expect(await deviceStore('outbox').getAll()).toEqual([])
  })

  it('waits for the answer to a write it adds and sends, but not past the time given', async () => {
    const outbox = newOutbox()
    await open(outbox, ASH)
    expect((await outbox.addAndSend(draft('t1'), 1_000)).settlement).toMatchObject({
      outcome: 'done',
    })

    server.send = () => new Promise(() => {})
    const slow = new Outbox({ store: deviceOutboxStore(), send: server.send })
    await slow.open(ASH)
    expect((await slow.addAndSend(draft('t1'), 20)).settlement).toBeUndefined()
    expect(slow.state.pending).toHaveLength(1)
  })

  it('tells the page what was sent, and what left the outbox unsent', async () => {
    const outbox = newOutbox()
    await open(outbox, ASH)
    const events: OutboxEvent['type'][] = []
    outbox.subscribe((event) => events.push(event.type))
    server.answerAll({ status: 400, body: { error: 'Invalid request', fields: { x: 'Bad.' } } })
    await outbox.add(draft('t1'))
    await outbox.flush()
    expect(events).toEqual(['changed', 'progress', 'attempted', 'changed', 'withdrawn'])
  })

  it('tells the page which write is on its way, and which a page is still saving', async () => {
    let answer: (value: Answer) => void = () => {}
    const outbox = new Outbox({
      store: deviceOutboxStore(),
      send: () => new Promise((resolve) => (answer = resolve)),
    })
    await outbox.open(ASH)
    const write = draft('t1')
    const saving = outbox.addAndSend(write, 1_000)
    await vi.waitFor(() => expect(outbox.state.sending).toBe(write.id))
    expect(outbox.state.saving).toEqual([write.id])

    answer({ status: 201 })
    await saving
    expect(outbox.state.sending).toBeUndefined()
    expect(outbox.state.saving).toBeUndefined()
  })

  it('stops counting a write as being saved once the page stops waiting for it', async () => {
    const outbox = new Outbox({ store: deviceOutboxStore(), send: () => new Promise(() => {}) })
    await outbox.open(ASH)
    await outbox.addAndSend(draft('t1'), 20)
    expect(outbox.state.saving).toBeUndefined()
    expect(outbox.state.pending).toHaveLength(1)
  })

  it('sends a rejected write again with the fix made to it, keeping its place', async () => {
    const outbox = newOutbox()
    await open(outbox, ASH)
    server.answerAll({ status: 409, body: { error: 'Round 4 is already logged.' } })
    const write = await outbox.add(draft('t1'))
    await outbox.flush()
    expect(outbox.state.rejected).toHaveLength(1)

    server.answerAll({ status: 201 })
    const fixed = { ...write.request, body: { id: write.id, roundNumber: 5 } }
    const settlement = await outbox.resend(
      write.id,
      { request: { ...fixed, url: '/api/fixed' }, label: 'Round 5 in Worlds' },
      1_000,
    )
    expect(settlement).toMatchObject({ outcome: 'done' })
    expect(server.sent.at(-1)).toBe('/api/fixed')
    expect(outbox.state).toMatchObject({ pending: [], rejected: [] })
  })

  it('keeps a fixed write rejected, with the new message, when the server refuses it again', async () => {
    const outbox = newOutbox()
    await open(outbox, ASH)
    server.answerAll({ status: 409, body: { error: 'Round 4 is already logged.' } })
    const write = await outbox.add(draft('t1'))
    await outbox.flush()

    server.answerAll({ status: 409, body: { error: 'Round 5 is already logged.' } })
    const settlement = await outbox.resend(write.id, { label: 'Round 5 in Worlds' }, 1_000)
    expect(settlement).toMatchObject({ outcome: 'rejected' })
    expect(outbox.state.rejected).toMatchObject([
      {
        id: write.id,
        label: 'Round 5 in Worlds',
        state: { message: 'Round 5 is already logged.' },
      },
    ])
  })
})

describe('Discarding a new record', () => {
  const create = (id: string) => ({ ...draft(`tournament:${id}`), creates: `tournament:${id}` })

  it('takes the writes waiting on it along, and only those', () => {
    const writes = [create('t1'), draft('tournament:t1'), draft('tournament:t2')].map(
      (d, order) =>
        ({ ...d, order, userId: ASH, state: { status: 'pending', attempts: 0 } }) as OutboxWrite,
    )
    expect(discardedWith(writes, writes[0]!).map((w) => w.id)).toEqual([
      writes[0]!.id,
      writes[1]!.id,
    ])
    expect(discardedWith(writes, writes[1]!).map((w) => w.id)).toEqual([writes[1]!.id])
  })

  it('removes a new Tournament and the Rounds logged in it from the device', async () => {
    const outbox = newOutbox()
    server.answerAll({ status: 'unreachable' })
    await open(outbox, ASH)
    const tournament = await outbox.add(create('t1'))
    const round = await outbox.add(draft('tournament:t1'))
    const other = await outbox.add(draft('tournament:t2'))
    const events: OutboxEvent[] = []
    outbox.subscribe((event) => events.push(event))

    await outbox.discard(tournament.id)
    expect(outbox.state.pending.map((w) => w.id)).toEqual([other.id])
    expect(events.find((e) => e.type === 'withdrawn')).toMatchObject({
      writes: [{ id: tournament.id }, { id: round.id }],
    })
    const later = newOutbox()
    await open(later, ASH)
    expect(later.state.pending.map((w) => w.id)).toEqual([other.id])
  })

  it('keeps the Rounds waiting while the new Tournament is refused, and sends them once it is fixed', async () => {
    const outbox = newOutbox()
    await open(outbox, ASH)
    server.answerAll({ status: 'unreachable' })
    const tournament = await outbox.add(create('t1'))
    const round = await outbox.add(draft('tournament:t1'))
    server.sent.length = 0
    server.answerAll({ status: 200 })
    server.answer(tournament.request.url, { status: 400, body: { error: 'Give it a name.' } })
    await outbox.flush()
    expect(server.sent).toEqual([tournament.request.url])
    expect(outbox.state.rejected.map((w) => w.id)).toEqual([tournament.id])
    expect(outbox.state.pending.map((w) => w.id)).toEqual([round.id])

    await outbox.resend(tournament.id, {}, 1_000)
    await outbox.flush()
    expect(server.sent).toEqual([tournament.request.url, tournament.request.url, round.request.url])
    expect(outbox.writes).toEqual([])
  })

  it('stops holding back a series once a fix no longer creates its record', async () => {
    const outbox = newOutbox()
    await open(outbox, ASH)
    server.answerAll({ status: 'unreachable' })
    // A Round adding a new Opponent, and a change to that Opponent waiting on it.
    const round = await outbox.add({ ...draft('opponent:o1'), creates: 'opponent:o1' })
    const change = await outbox.add(draft('opponent:o1', 'PATCH'))
    server.answer(round.request.url, { status: 409, body: { error: 'Already logged.' } })
    server.answerAll({ status: 200 })
    await outbox.flush()
    expect(outbox.state.pending.map((w) => w.id)).toEqual([change.id])

    // Fixed to keep it refused but no longer adding the Opponent: the change goes ahead.
    server.answer(round.request.url, { status: 409, body: { error: 'Already logged.' } })
    await outbox.resend(round.id, { creates: undefined }, 1_000)
    await outbox.flush()
    expect(outbox.writes.find((w) => w.id === round.id)?.creates).toBeUndefined()
    expect(outbox.writes.map((w) => w.id)).toEqual([round.id])
  })
})

describe('Deleting a record the server never got (DEV-207)', () => {
  const create = (id: string) => ({ ...draft(`tournament:${id}`), creates: `tournament:${id}` })
  const removal = (id: string) => ({
    ...draft(`tournament:${id}`, 'DELETE'),
    deletes: `tournament:${id}`,
  })

  it('sends neither its create nor the delete, and takes both off the device', async () => {
    const outbox = newOutbox()
    await open(outbox, ASH)
    server.answerAll({ status: 'unreachable' })
    const tournament = await outbox.add(create('t1'))
    const round = await outbox.add(draft('tournament:t1'))
    const other = await outbox.add(draft('tournament:t2'))
    const events: OutboxEvent[] = []
    outbox.subscribe((event) => events.push(event))
    server.sent.length = 0

    expect(await saveChange(outbox, removal('t1'))).toEqual({ sent: true, body: undefined })
    expect(server.sent).toEqual([])
    expect(outbox.state.pending.map((w) => w.id)).toEqual([other.id])
    expect(events.find((e) => e.type === 'withdrawn')).toMatchObject({
      writes: [{ id: tournament.id }, { id: round.id }],
    })
    server.answerAll({ status: 200 })
    const later = newOutbox()
    await open(later, ASH)
    expect(server.sent).toEqual([other.request.url])
  })

  it('sends the delete as usual once another tab has sent the create', async () => {
    const outbox = newOutbox()
    await open(outbox, ASH)
    server.answerAll({ status: 'unreachable' })
    const tournament = await outbox.add(create('t1'))
    server.answerAll({ status: 200 })
    await open(newOutbox(), ASH)
    expect(server.sent.at(-1)).toBe(tournament.request.url)

    const deleting = removal('t1')
    server.answer(deleting.request.url, { status: 200, body: { deleted: true } })
    expect(await saveChange(outbox, deleting)).toEqual({ sent: true, body: { deleted: true } })
    expect(server.sent.at(-1)).toBe(deleting.request.url)
    expect(outbox.writes).toEqual([])
  })
})

describe('Saving a change from a page', () => {
  it('gives the page the answer when the server answers in time', async () => {
    const outbox = newOutbox()
    await open(outbox, ASH)
    server.answerAll({ status: 201, body: { suggestedPlacement: 3 } })
    expect(await saveChange(outbox, draft('t1'))).toEqual({
      sent: true,
      body: { suggestedPlacement: 3 },
    })
    expect(outbox.state.pending).toEqual([])
  })

  it('gives the form a refusal to show, and drops the change since the User is there', async () => {
    const outbox = newOutbox()
    await open(outbox, ASH)
    server.answerAll({
      status: 409,
      body: { error: 'Round 3 is already logged.', fields: { roundNumber: 'Round 3 is…' } },
    })
    const saving = saveChange(outbox, draft('t1'))
    await expect(saving).rejects.toBeInstanceOf(RejectedChange)
    await expect(saving).rejects.toMatchObject({
      statusCode: 409,
      fields: { roundNumber: 'Round 3 is…' },
    })
    expect(outbox.state).toMatchObject({ pending: [], rejected: [] })
  })

  it('keeps the change on the device when the server can’t be reached', async () => {
    const outbox = newOutbox()
    await open(outbox, ASH)
    server.answerAll({ status: 'unreachable' })
    expect(await saveChange(outbox, draft('t1'))).toEqual({ sent: false })
    expect(outbox.state.pending).toHaveLength(1)
  })
})
