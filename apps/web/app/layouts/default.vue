<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { authClient } from '@/lib/auth-client'

const session = authClient.useSession()

// The main areas of the app, in the order a User reaches for them at an event.
const areas = [
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/teams', label: 'Teams' },
  { to: '/opponents', label: 'Opponents' },
  { to: '/dashboard', label: 'Dashboard' },
]
const route = useRoute()
const isCurrent = (to: string) => route.path === to || route.path.startsWith(`${to}/`)
const queryClient = useQueryClient()

async function logOut() {
  await authClient.signOut()
  // Drop everything cached for this User before anyone else logs in on this device.
  queryClient.clear()
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="border-b">
      <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <NuxtLink to="/teams" class="text-lg font-semibold">MyVGC</NuxtLink>
        <div class="flex min-w-0 items-center gap-3">
          <span
            v-if="session.data"
            class="text-muted-foreground hidden truncate text-sm sm:inline"
            data-testid="current-user"
          >
            {{ session.data.user.email }}
          </span>
          <Button variant="outline" size="sm" @click="logOut">Log out</Button>
        </div>
      </div>
      <nav aria-label="Main" class="mx-auto w-full max-w-3xl overflow-x-auto px-2">
        <ul class="flex gap-1">
          <li v-for="area in areas" :key="area.to">
            <NuxtLink
              :to="area.to"
              :aria-current="isCurrent(area.to) ? 'page' : undefined"
              class="text-muted-foreground hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:text-foreground focus-visible:ring-ring/50 block border-b-2 border-transparent px-2 py-2 sm:px-3 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3"
            >
              {{ area.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </header>
    <main class="mx-auto w-full max-w-3xl flex-1 p-4">
      <slot />
    </main>
  </div>
</template>
