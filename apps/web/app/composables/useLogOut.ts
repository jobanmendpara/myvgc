import { useQueryClient } from '@tanstack/vue-query'
import { authClient } from '@/lib/auth-client'
import { forgetDevice } from '@/lib/device-cache'

/**
 * Logs out and goes to /login, removing what the app keeps on this device: the last known User,
 * the saved query cache and, once the User agrees to lose them, their changes not yet synced
 * (ADR 17). Device settings, such as the theme, stay on the device. Settings' "Clear data on this
 * device" is this same action; it asks about unsynced changes itself and passes
 * `unsyncedConfirmed`.
 */
export function useLogOut() {
  const queryClient = useQueryClient()
  const currentUser = useCurrentUser()
  const { $outbox } = useNuxtApp()
  return async function logOut(options: { unsyncedConfirmed?: boolean } = {}) {
    // Ask about unsaved edits while they can still be saved.
    if (!(await confirmDiscardAll())) return
    const { pending, rejected } = $outbox.state
    const unsynced = pending.length + rejected.length
    if (unsynced && !options.unsyncedConfirmed && !(await confirmLosingUnsynced(unsynced))) return
    // With no connection the server can't be told, but the device's data is cleared anyway.
    await authClient.signOut().catch(() => {})
    const userId = currentUser.value?.id
    currentUser.value = null
    if (userId) await $outbox.clear(userId).catch(() => {})
    $outbox.close()
    // Drop everything kept for this User before anyone else logs in on this device.
    await forgetDevice(queryClient)
    forgetChampionsNames()
    await navigateTo('/login')
  }
}
