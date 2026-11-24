import { onlineManager, QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { CACHE_MAX_AGE } from '@/lib/device-cache'

export default defineNuxtPlugin({
  name: 'vue-query',
  setup(nuxtApp) {
    const queryClient = new QueryClient({
      defaultOptions: {
        // The cache is saved on the device for the signed-in User (ADR 17), so unused queries,
        // such as the Opponents list the Round form searches offline, are kept as long as it is.
        queries: { staleTime: 30_000, retry: 1, gcTime: CACHE_MAX_AGE },
      },
    })
    // TanStack Query assumes it is online until an `online` or `offline` event says otherwise, and
    // a launch with no signal fires neither: queries would fetch, fail and turn to errors rather
    // than wait (DEV-209). Start from what the browser knows instead.
    if (import.meta.client) onlineManager.setOnline(navigator.onLine)
    nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })
    // The auth middleware runs outside components, where `useQueryClient` can't reach it.
    return { provide: { queryClient } }
  },
})
