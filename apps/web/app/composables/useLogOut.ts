import { useQueryClient } from '@tanstack/vue-query'
import { authClient } from '@/lib/auth-client'
import { forgetDevice } from '@/lib/device-cache'

/**
 * Logs out and goes to /login, removing what the app keeps on this device: the last known User
 * and the saved query cache (ADR 17). Device settings, such as the theme, stay on the device.
 * Settings' "Clear data on this device" is this same action.
 */
export function useLogOut() {
  const queryClient = useQueryClient()
  const currentUser = useCurrentUser()
  return async function logOut() {
    // Ask about unsaved edits while they can still be saved.
    if (!(await confirmDiscardAll())) return
    // With no connection the server can't be told, but the device's data is cleared anyway.
    await authClient.signOut().catch(() => {})
    currentUser.value = null
    // Drop everything kept for this User before anyone else logs in on this device.
    await forgetDevice(queryClient)
    forgetChampionsNames()
    await navigateTo('/login')
  }
}
