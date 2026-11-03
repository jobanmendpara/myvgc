import { useMutation } from '@tanstack/vue-query'

/**
 * Runs a Better Auth call from a form, turning its `{ error }` result into a thrown Error
 * so the page can show the message, then goes to `next` (or /) on success.
 */
export function useAuthForm(action: () => Promise<{ error: { message?: string } | null }>) {
  const route = useRoute()
  return useMutation({
    mutationFn: async () => {
      const { error } = await action()
      if (error) throw new Error(error.message || 'Something went wrong. Try again.')
    },
    onSuccess: () => {
      const next =
        typeof route.query.next === 'string' && route.query.next.startsWith('/')
          ? route.query.next
          : '/'
      return navigateTo(next)
    },
  })
}
