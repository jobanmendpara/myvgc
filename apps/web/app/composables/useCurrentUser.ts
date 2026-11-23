import type { LastKnownUser } from '@/lib/device-cache'

/**
 * The User the app is open as, set by the auth middleware: the signed-in User or, when the
 * server can't be reached, the last known User saved on this device. `null` when logged out.
 */
export function useCurrentUser() {
  return useState<LastKnownUser | null>('current-user', () => null)
}
