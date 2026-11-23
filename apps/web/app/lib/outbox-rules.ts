// The outbox's rules (ADR 17): which pending write goes next, and what the server's answer to it
// means. Pure, so it is tested without a browser, a server or a database.

/**
 * The format of a write as it is kept on the device. Bump it when {@link OutboxWrite} changes
 * shape. A write kept in another format is never dropped: it is shown as rejected, so the User
 * can see it and discard it. `id`, `userId` and `order` make up its key and never change.
 */
export const OUTBOX_FORMAT = 1

/** How often pending writes are tried again while the page is visible. */
export const RETRY_INTERVAL = 30_000

/** What a write does, which the page shows and the optimistic updates follow. */
export type WriteKind =
  | 'log-round'
  | 'edit-round'
  | 'delete-round'
  | 'add-opponent'
  | 'add-note-entry'
  | 'edit-note-entry'
  | 'delete-note-entry'

/** The request a write sends, to one of the API's existing routes. */
export interface WriteRequest {
  method: 'POST' | 'PATCH' | 'DELETE'
  url: string
  body?: unknown
}

export type WriteState =
  /** Waiting to be sent, or sent and to be tried again. */
  | { status: 'pending'; attempts: number }
  /** The server refused it (or it can't be read); kept until the User discards or retries it. */
  | { status: 'rejected'; message: string; fields?: Record<string, string> }

/** One change made on this device and not yet settled with the server. */
export interface OutboxWrite {
  id: string
  userId: string
  format: number
  /** Writes are sent in this order: when they were made. */
  order: number
  /** When it was made, as an ISO timestamp. */
  createdAt: string
  kind: WriteKind
  request: WriteRequest
  /**
   * The series it runs in, such as `tournament:<id>` or `opponent:<id>`. A write waits for every
   * earlier pending write that shares one of its series.
   */
  series: string[]
  /** The records it is about, so the page knows what to update. */
  subject: WriteSubject
  /** What the change is, in a few words, such as "Round 3 in Worlds 2026". */
  label: string
  state: WriteState
}

export interface WriteSubject {
  tournamentId?: string
  roundId?: string
  opponentId?: string
  /** The Opponent's display name, for a Round shown before the server has it. */
  opponentName?: string
  noteEntryId?: string
  /** The record as it was before the change, so discarding the change can put it back. */
  before?: unknown
}

/** The server's answer to a write, or none at all. */
export type Answer = { status: number; body?: unknown } | { status: 'unreachable' }

/** What an answer means for the write. */
export type Settlement =
  /** Saved, or nothing left to do. The write leaves the outbox. */
  | { outcome: 'done'; body?: unknown }
  /** Refused. The write stays, shown with the server's message, until the User acts on it. */
  | { outcome: 'rejected'; status: number; message: string; fields?: Record<string, string> }
  /** The session has ended: every write waits until the User logs in again. */
  | { outcome: 'login' }
  /** The server can't be reached, or failed: try again later. */
  | { outcome: 'retry'; unreachable: boolean }

const GONE_MESSAGE =
  'What this change belongs to no longer exists. It may have been deleted on another device.'

/** The message for a write kept in a format this version of the app can't send. */
export const OLD_FORMAT_MESSAGE =
  "Saved by another version of MyVGC and can't be sent. Discard it, then make the change again."

function rejection(status: number, body: unknown, fallback: string): Settlement {
  const { error, fields } = (body ?? {}) as { error?: unknown; fields?: unknown }
  const named =
    fields && typeof fields === 'object' ? (fields as Record<string, string>) : undefined
  const first = named ? Object.values(named)[0] : undefined
  const message =
    typeof error === 'string' && error !== 'Invalid request' ? error : (first ?? fallback)
  return { outcome: 'rejected', status, message, ...(named ? { fields: named } : {}) }
}

/** Settles a write with the server's answer (ADR 17). */
export function settle(write: Pick<OutboxWrite, 'request'>, answer: Answer): Settlement {
  if (answer.status === 'unreachable') return { outcome: 'retry', unreachable: true }
  const { status, body } = answer
  if (status >= 200 && status < 300) return { outcome: 'done', body }
  // An edit or delete of something that no longer exists has nothing left to do.
  if (status === 404 && write.request.method !== 'POST') return { outcome: 'done' }
  if (status === 404) return rejection(status, undefined, GONE_MESSAGE)
  if (status === 401) return { outcome: 'login' }
  if (status === 408 || status === 429 || status >= 500)
    return { outcome: 'retry', unreachable: false }
  return rejection(status, body, `The server refused this change (${status}).`)
}

const isPending = (write: OutboxWrite) => write.state.status === 'pending'

/**
 * The next write to send: the first pending one, in the order they were made, that no earlier
 * pending write in one of its series is waiting ahead of. `skip` holds writes already tried in
 * this pass; they still hold back the rest of their series.
 */
export function nextWrite(
  writes: readonly OutboxWrite[],
  skip: ReadonlySet<string> = new Set(),
): OutboxWrite | undefined {
  const waiting = new Set<string>()
  for (const write of inOrder(writes)) {
    if (!isPending(write)) continue
    const blocked = write.series.some((key) => waiting.has(key))
    for (const key of write.series) waiting.add(key)
    if (!blocked && !skip.has(write.id)) return write
  }
  return undefined
}

/** Writes in the order they were made. */
export const inOrder = (writes: readonly OutboxWrite[]) =>
  writes.toSorted((a, b) => a.order - b.order || a.id.localeCompare(b.id))

/** The write after a settlement: rejected, or pending with one more attempt. */
export function afterAttempt(write: OutboxWrite, settlement: Settlement): OutboxWrite {
  if (settlement.outcome === 'rejected') {
    const { message, fields } = settlement
    return { ...write, state: { status: 'rejected', message, ...(fields ? { fields } : {}) } }
  }
  const attempts = write.state.status === 'pending' ? write.state.attempts + 1 : 1
  return { ...write, state: { status: 'pending', attempts } }
}

/**
 * Reads a write kept on the device. One in another format, or one that can't be read, is kept
 * and shown as rejected, never dropped.
 */
export function readStoredWrite(value: unknown): OutboxWrite | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Partial<OutboxWrite>
  if (typeof raw.id !== 'string' || typeof raw.userId !== 'string') return undefined
  if (raw.format === OUTBOX_FORMAT) return raw as OutboxWrite
  return {
    id: raw.id,
    userId: raw.userId,
    format: typeof raw.format === 'number' ? raw.format : 0,
    order: typeof raw.order === 'number' ? raw.order : 0,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    kind: raw.kind ?? 'log-round',
    request: raw.request ?? { method: 'POST', url: '' },
    series: [],
    subject: {},
    label: typeof raw.label === 'string' ? raw.label : 'A change',
    state: { status: 'rejected', message: OLD_FORMAT_MESSAGE },
  }
}

/** Whether a write can be sent by this version of the app. */
export const canSend = (write: OutboxWrite) => write.format === OUTBOX_FORMAT

/** What the outbox shows the page. */
export interface OutboxState {
  /** Writes still to be sent, in order. */
  pending: OutboxWrite[]
  /** Writes the server refused, each with its message, in order. */
  rejected: OutboxWrite[]
  /** The session ended: nothing is sent until the User logs in again. */
  waitingForLogin: boolean
}

export function outboxState(writes: readonly OutboxWrite[], waitingForLogin: boolean): OutboxState {
  const ordered = inOrder(writes)
  return {
    pending: ordered.filter(isPending),
    rejected: ordered.filter((write) => !isPending(write)),
    waitingForLogin,
  }
}

/** Whether any write is waiting to be sent and could be, so it is worth trying again. */
export const worthTrying = (state: OutboxState) =>
  state.pending.length > 0 && !state.waitingForLogin
