import { deviceStore } from './device-database'
import {
  type Answer,
  afterAttempt,
  canSend,
  discardedWith,
  inOrder,
  nextWrite,
  OUTBOX_FORMAT,
  type OutboxState,
  type OutboxWrite,
  outboxState,
  readStoredWrite,
  type Settlement,
  settle,
  type WriteRequest,
} from './outbox-rules'

// The outbox (ADR 17): the Tournaments, Rounds, Opponents, Note entries and account settings a
// User saves are kept on the device first, then sent to the server, in order, whenever it can be
// reached. Nothing in it expires, and clearing the query cache never touches it. Its rules are in
// outbox-rules.ts.

/**
 * A plain copy of what a page hands the outbox. A page's data, such as the Round being deleted,
 * is often a Vue Proxy, which IndexedDB can't keep; a write is JSON when it is sent anyway.
 */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/** Where the writes are kept: the `outbox` store, one record per write. */
export interface OutboxStore {
  /** Every write kept for a User, as stored. */
  list(userId: string): Promise<unknown[]>
  put(write: OutboxWrite): Promise<void>
  remove(write: Pick<OutboxWrite, 'id' | 'userId' | 'order'>): Promise<void>
  /** Removes every write kept for a User. */
  clear(userId: string): Promise<void>
}

/** A write before it is in the outbox: the outbox fills in who, when and its state. */
export type WriteDraft = Omit<OutboxWrite, 'userId' | 'format' | 'order' | 'createdAt' | 'state'>

/** What fixing a rejected write changes in it. */
export type WriteFix = Partial<
  Pick<OutboxWrite, 'request' | 'label' | 'series' | 'subject' | 'creates'>
>

export type OutboxEvent =
  | { type: 'changed'; state: OutboxState }
  /** Only what is being sent or saved changed: the writes themselves are as they were. */
  | { type: 'progress'; state: OutboxState }
  /** A write was sent and answered, or couldn't be sent. */
  | { type: 'attempted'; write: OutboxWrite; settlement: Settlement }
  /** Writes left the outbox, or stopped being pending, so the page can stop showing them. */
  | { type: 'withdrawn'; writes: OutboxWrite[] }

export interface OutboxOptions {
  store: OutboxStore
  send: (request: WriteRequest) => Promise<Answer>
  /** Runs a pass on its own, across tabs too, so no write is sent twice at once. */
  exclusive?: <T>(run: () => Promise<T>) => Promise<T>
  now?: () => number
}

export class Outbox {
  #store: OutboxStore
  #send: OutboxOptions['send']
  #exclusive: NonNullable<OutboxOptions['exclusive']>
  #now: () => number
  #userId: string | undefined
  #writes: OutboxWrite[] = []
  #waitingForLogin = false
  #saving = new Set<string>()
  #sending: string | undefined
  #listeners = new Set<(event: OutboxEvent) => void>()
  #running: Promise<void> | undefined
  #again = false

  constructor(options: OutboxOptions) {
    this.#store = options.store
    this.#send = options.send
    this.#exclusive = options.exclusive ?? ((run) => run())
    this.#now = options.now ?? Date.now
  }

  get userId() {
    return this.#userId
  }

  get writes(): readonly OutboxWrite[] {
    return inOrder(this.#writes)
  }

  get state(): OutboxState {
    return outboxState(this.#writes, this.#waitingForLogin, {
      saving: [...this.#saving],
      sending: this.#sending,
    })
  }

  subscribe(listener: (event: OutboxEvent) => void) {
    this.#listeners.add(listener)
    return () => void this.#listeners.delete(listener)
  }

  #emit(event: OutboxEvent) {
    for (const listener of this.#listeners) listener(event)
  }

  #changed() {
    this.#emit({ type: 'changed', state: this.state })
  }

  #progress() {
    this.#emit({ type: 'progress', state: this.state })
  }

  async #load(userId: string) {
    const stored = await this.#store.list(userId).catch(() => undefined)
    // Another User may have signed in while the device was being read.
    if (!stored || this.#userId !== userId) return
    this.#writes = stored
      .map(readStoredWrite)
      .filter((write): write is OutboxWrite => write?.userId === userId)
  }

  /**
   * Opens a User's outbox, as they sign in or the app opens as them, and tries to send what is
   * pending. Signing in again ends a wait for login.
   */
  async open(userId: string) {
    this.#userId = userId
    this.#waitingForLogin = false
    await this.#load(userId)
    this.#changed()
    void this.flush()
  }

  /** Stops sending, as a User logs out. What is kept on the device stays. */
  close() {
    this.#userId = undefined
    this.#writes = []
    this.#waitingForLogin = false
    this.#changed()
  }

  /**
   * Adds a write. It is on the device before this resolves, so the page can then show it as
   * saved. Rejects if the device can't keep it.
   */
  async add(draft: WriteDraft): Promise<OutboxWrite> {
    const userId = this.#userId
    if (!userId) throw new Error('No User is signed in.')
    const latest = Math.max(0, ...this.#writes.map((w) => w.order))
    const now = this.#now()
    const write: OutboxWrite = {
      ...plain(draft),
      userId,
      format: OUTBOX_FORMAT,
      order: Math.max(now, latest + 1),
      createdAt: new Date(now).toISOString(),
      state: { status: 'pending', attempts: 0 },
    }
    await this.#store.put(write)
    if (this.#userId === userId && !this.#writes.some((w) => w.id === write.id))
      this.#writes.push(write)
    this.#changed()
    return write
  }

  /** Sends what is pending, in order, until it is all sent or the server can't be reached. */
  flush(): Promise<void> {
    if (this.#running) {
      this.#again = true
      return this.#running
    }
    this.#running = (async () => {
      do {
        this.#again = false
        await this.#exclusive(() => this.#pass())
      } while (this.#again)
    })().finally(() => {
      this.#running = undefined
    })
    return this.#running
  }

  async #pass() {
    const userId = this.#userId
    if (!userId) return
    // Another tab may have sent or added writes since this one last looked.
    await this.#load(userId)
    const tried = new Set<string>()
    while (this.#userId === userId && !this.#waitingForLogin) {
      const write = nextWrite(this.#writes, tried)
      if (!write) break
      tried.add(write.id)
      this.#sending = write.id
      this.#progress()
      const answer = await this.#send(write.request).finally(() => {
        this.#sending = undefined
      })
      // Discarded, or another User signed in, while it was on its way.
      const current = this.#writes.find((w) => w.id === write.id)
      if (this.#userId !== userId || !current) continue
      const settlement = settle(write, answer)
      if (settlement.outcome === 'done') {
        this.#writes = this.#writes.filter((w) => w.id !== write.id)
        await this.#store.remove(write).catch(() => {})
      } else if (settlement.outcome === 'login') {
        this.#waitingForLogin = true
      } else {
        const next = afterAttempt(current, settlement)
        this.#writes = this.#writes.map((w) => (w.id === write.id ? next : w))
        await this.#store.put(next).catch(() => {})
      }
      this.#emit({ type: 'attempted', write: current, settlement })
      this.#changed()
      if (settlement.outcome === 'rejected') this.#emit({ type: 'withdrawn', writes: [current] })
      // With no connection, the rest would fail the same way.
      if (settlement.outcome === 'retry' && settlement.unreachable) break
    }
  }

  /**
   * Adds a write and tries to send it, waiting at most `timeout` ms for the answer. Resolves with
   * the answer's settlement, or nothing when it is still pending: kept on the device, to be sent
   * later.
   */
  async addAndSend(
    draft: WriteDraft,
    timeout: number,
  ): Promise<{ write: OutboxWrite; settlement: Settlement | undefined }> {
    this.#saving.add(draft.id)
    try {
      const write = await this.add(draft)
      return { write, settlement: await this.#answerFor(write.id, timeout) }
    } finally {
      this.#saving.delete(draft.id)
      this.#progress()
    }
  }

  /** Sends what is pending and waits for a write's answer, at most `timeout` ms. */
  #answerFor(id: string, timeout: number): Promise<Settlement | undefined> {
    return new Promise<Settlement | undefined>((resolve) => {
      let settled = false
      const finish = (value: Settlement | undefined) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        unsubscribe()
        resolve(value)
      }
      const timer = setTimeout(() => finish(undefined), timeout)
      const unsubscribe = this.subscribe((event) => {
        if (event.type === 'attempted' && event.write.id === id) finish(event.settlement)
      })
      void this.flush().then(() => finish(undefined))
    })
  }

  /**
   * Removes a write without sending it. Discarding a create, such as a new Tournament, also
   * removes the writes waiting on what it creates, such as the Rounds logged in it.
   */
  async discard(id: string) {
    const write = this.#writes.find((w) => w.id === id)
    if (!write) return
    const gone = discardedWith(this.#writes, write)
    for (const each of gone) await this.#store.remove(each)
    const ids = new Set(gone.map((w) => w.id))
    this.#writes = this.#writes.filter((w) => !ids.has(w.id))
    this.#changed()
    this.#emit({ type: 'withdrawn', writes: gone })
  }

  /** Puts a rejected write back in line and tries to send it again. */
  async retry(id: string) {
    await this.resend(id, {}, 0)
  }

  /**
   * Puts a rejected write back in line with the User's fix, keeping its place, and sends it.
   * Waits at most `timeout` ms for the answer; nothing when it is still pending.
   */
  async resend(id: string, fix: WriteFix, timeout: number): Promise<Settlement | undefined> {
    const write = this.#writes.find((w) => w.id === id)
    if (!write || write.state.status === 'pending' || !canSend(write)) return undefined
    const next: OutboxWrite = { ...write, ...plain(fix), state: { status: 'pending', attempts: 0 } }
    // A fix that no longer creates a record, such as a Round no longer adding a new Opponent.
    if ('creates' in fix && !fix.creates) delete next.creates
    await this.#store.put(next)
    this.#writes = this.#writes.map((w) => (w.id === id ? next : w))
    this.#saving.add(id)
    this.#changed()
    try {
      return await this.#answerFor(id, timeout)
    } finally {
      this.#saving.delete(id)
      this.#progress()
    }
  }

  /** Removes every write kept for a User, as they log out having agreed to lose them. */
  async clear(userId: string) {
    await this.#store.clear(userId)
    if (this.#userId !== userId) return
    const gone = this.#writes
    this.#writes = []
    this.#waitingForLogin = false
    this.#changed()
    if (gone.length) this.#emit({ type: 'withdrawn', writes: gone })
  }
}

/** The writes kept on this device, in the `outbox` object store, keyed by User. */
export function deviceOutboxStore(): OutboxStore {
  const store = deviceStore<unknown>('outbox')
  const keyOf = (write: Pick<OutboxWrite, 'id' | 'userId' | 'order'>) => [
    write.userId,
    write.order,
    write.id,
  ]
  // Every key that starts with the user id. Arrays sort after numbers and strings.
  const ofUser = (userId: string) => IDBKeyRange.bound([userId], [userId, []])
  return {
    list: (userId) => store.getAll(ofUser(userId)),
    put: (write) => store.set(keyOf(write), write),
    remove: (write) => store.delete(keyOf(write)),
    clear: (userId) => store.delete(ofUser(userId)),
  }
}

/** A change the server refused while the User was still on the page that made it. */
export class RejectedChange extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'RejectedChange'
  }
}

/** What became of a change saved through the outbox. */
export type SavedChange =
  /** The server has it; `body` is its answer. */
  | { sent: true; body: unknown }
  /** It is kept on this device, to be sent when the server can be reached. */
  | { sent: false }

/** How long a page waits for the server before showing a change as saved on the device. */
export const ANSWER_WAIT = 4_000

/**
 * Saves a change through the outbox: kept on the device first, then sent. When the server answers
 * in time, the page gets the answer as usual; a refusal comes back as a {@link RejectedChange}
 * for the form to show, and the change leaves the outbox, since the User is there to fix it.
 * Otherwise it stays in the outbox, to be sent later. If the device can't keep it, it is sent
 * straight away instead.
 */
export async function saveChange(
  outbox: Outbox,
  draft: WriteDraft,
  wait = ANSWER_WAIT,
): Promise<SavedChange> {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  let added: Awaited<ReturnType<Outbox['addAndSend']>>
  try {
    added = await outbox.addAndSend(draft, offline ? 0 : wait)
  } catch {
    const settlement = settle(draft, await sendRequest(draft.request))
    if (settlement.outcome === 'done') return { sent: true, body: settlement.body }
    if (settlement.outcome === 'rejected')
      throw new RejectedChange(settlement.status, settlement.message, settlement.fields)
    if (settlement.outcome === 'login') throw new RejectedChange(401, 'Your session has ended.')
    throw new Error("Couldn't save, and this device can't keep the change to send later.")
  }
  const { write, settlement } = added
  if (settlement?.outcome === 'done') return { sent: true, body: settlement.body }
  if (settlement?.outcome === 'rejected') {
    await outbox.discard(write.id).catch(() => {})
    throw new RejectedChange(settlement.status, settlement.message, settlement.fields)
  }
  return { sent: false }
}

const SEND_TIMEOUT = 20_000

/** Sends a write's request. Any failure to get an answer counts as unreachable. */
export async function sendRequest(request: WriteRequest): Promise<Answer> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT)
  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.body === undefined ? {} : { 'content-type': 'application/json' },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      credentials: 'same-origin',
      signal: controller.signal,
    })
    const body: unknown = await response.json().catch(() => undefined)
    return { status: response.status, body }
  } catch {
    return { status: 'unreachable' }
  } finally {
    clearTimeout(timer)
  }
}

/** Runs one outbox pass at a time across this device's tabs, where the browser allows it. */
export function acrossTabs<T>(run: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  return locks ? (locks.request('myvgc-outbox', run) as Promise<T>) : run()
}
