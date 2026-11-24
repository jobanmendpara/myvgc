<script setup lang="ts">
import { browserReloadEnvironment, reloadToNewVersion } from '@/lib/reload-to-new-version'

// A new version never loads on its own (ADR 17): it waits until the User chooses to reload, so a
// half-filled form isn't lost.
const { $pwa } = useNuxtApp()
const reloading = ref(false)

async function reload() {
  reloading.value = true
  // Activates the waiting version and reloads the page once it takes over, whether or not the
  // service worker controls this page (DEV-208).
  await reloadToNewVersion(
    browserReloadEnvironment(async () => {
      await $pwa?.updateServiceWorker(true)
    }),
  )
}
</script>

<template>
  <div
    v-if="$pwa?.needRefresh"
    role="status"
    class="bg-primary text-primary-foreground fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
  >
    <span class="text-sm font-medium">A new version of MyVGC is ready</span>
    <Button size="sm" variant="secondary" :disabled="reloading" @click="reload">Reload</Button>
  </div>
</template>
