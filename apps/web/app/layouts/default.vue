<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { authClient } from '@/lib/auth-client'

const session = authClient.useSession()
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
    </header>
    <main class="mx-auto w-full max-w-3xl flex-1 p-4">
      <slot />
    </main>
  </div>
</template>
