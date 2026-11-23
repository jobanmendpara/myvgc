import type { LastKnownUser } from './device-cache'

/** What the server said when asked who is signed in. */
export type SessionCheck =
  | { kind: 'signed-in'; user: LastKnownUser }
  | { kind: 'logged-out' }
  /** No answer: a network error, a timeout, or a server that isn't working. */
  | { kind: 'unreachable' }

/** Reads Better Auth's `getSession` result, or `undefined` when the call threw. */
export function readSessionCheck(
  result: { data: { user: LastKnownUser } | null; error: unknown } | undefined,
): SessionCheck {
  if (!result || result.error) return { kind: 'unreachable' }
  // A logged-out visitor gets `data: null` with no error.
  return result.data ? { kind: 'signed-in', user: result.data.user } : { kind: 'logged-out' }
}

/** Whom the app opens as. */
export type Start =
  /** `offline` when the server couldn't be reached and the last known User stands in. */
  | { kind: 'user'; user: LastKnownUser; offline: boolean }
  | { kind: 'logged-out' }
  /** The server can't be reached and no User was ever saved on this device. */
  | { kind: 'unreachable' }

/**
 * Decides whom the app opens as (ADR 17). Only a server that can't be reached lets the last
 * known User stand in; an answer of "logged out" always logs out.
 */
export function startAs(check: SessionCheck, lastKnown: LastKnownUser | undefined): Start {
  switch (check.kind) {
    case 'signed-in':
      return { kind: 'user', user: check.user, offline: false }
    case 'logged-out':
      return { kind: 'logged-out' }
    case 'unreachable':
      return lastKnown ? { kind: 'user', user: lastKnown, offline: true } : { kind: 'unreachable' }
  }
}
