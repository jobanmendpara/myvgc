import { useQueryClient } from '@tanstack/vue-query'
import { authClient } from '@/lib/auth-client'

/** Logs out and goes to /login. Device settings, such as the theme, stay on the device. */
export function useLogOut() {
  const queryClient = useQueryClient()
  return async function logOut() {
    // Ask about unsaved edits while they can still be saved.
    if (!(await confirmDiscardAll())) return
    await authClient.signOut()
    // Drop everything cached for this User before anyone else logs in on this device.
    queryClient.clear()
    forgetChampionsNames()
    await navigateTo('/login')
  }
}
