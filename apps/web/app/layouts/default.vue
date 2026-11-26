<script setup lang="ts">
import { CloudOffIcon } from '@lucide/vue'

// The main areas of the app: the Dashboard is home, then the order a User reaches for the rest
// at an event.
const areas = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/teams', label: 'Teams' },
  { to: '/opponents', label: 'Opponents' },
  { to: '/statistics', label: 'Statistics' },
]
const route = useRoute()
const isCurrent = (to: string) => route.path === to || route.path.startsWith(`${to}/`)

// An area in the list and detail layout fills the height below the header, so its list and
// pane scroll on their own (see ListDetail).
const wide = useWideLayout()
const split = computed(() => !!route.meta.listDetail && wide.value)

// Changes waiting on this phone show in a bar at the bottom of the screen (DEV-167). The Round
// form has its own banner for a refused change, and its buttons sit at the bottom.
const { bar, online } = useSyncBar()
const onRoundForm = computed(() => /^\/tournaments\/[^/]+\/rounds\//.test(route.path))
const shownBar = computed(() => (onRoundForm.value ? undefined : bar.value))
</script>

<template>
  <div class="flex flex-col" :class="split ? 'h-dvh' : 'min-h-dvh'">
    <header class="shrink-0 border-b">
      <div
        class="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
      >
        <NuxtLink to="/dashboard" class="text-lg font-semibold">MyVGC</NuxtLink>
        <!-- As tall as the Display options button, so the header keeps its height on the pages
             without it (DEV-192). -->
        <div class="flex min-h-9 items-center gap-1">
          <span
            v-if="!online"
            class="text-muted-foreground inline-flex items-center gap-1 px-1 text-xs"
            data-testid="offline"
          >
            <CloudOffIcon class="size-3.5" aria-hidden="true" /> Offline
          </span>
          <!-- PROTOTYPE (DEV-246), variant B. -->
          <PrototypeOfflineHeaderMark />
          <DisplayOptionsButton />
          <AccountMenu />
        </div>
      </div>
      <nav aria-label="Main" class="mx-auto w-full max-w-7xl overflow-x-auto px-2">
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
    <main
      class="mx-auto w-full max-w-7xl flex-1"
      :class="[split ? 'min-h-0' : 'p-4', { 'pb-24': shownBar && !split }]"
    >
      <slot />
    </main>
    <SyncBar v-if="shownBar" :bar="shownBar" :online="online" />
    <ChangesSheet />
  </div>
</template>
