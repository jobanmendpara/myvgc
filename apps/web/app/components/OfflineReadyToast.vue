<script setup lang="ts">
import { CloudCheckIcon, LoaderCircleIcon, XIcon } from '@lucide/vue'

// A toast in the bottom corner, on a device's first visit only (DEV-246, variant A of the
// prototype): "Getting ready for offline…" while the service worker downloads the app's files,
// then "Ready to use offline", which closes on its own. The live region stays on the page, so
// screen readers announce each change politely. On a phone it sits above the sync bar.
const notice = useOfflineReady()
const raised = useSyncBarShown()
</script>

<template>
  <div
    aria-live="polite"
    data-testid="offline-ready-region"
    class="pointer-events-none fixed inset-x-4 z-50 flex justify-end sm:left-auto sm:w-80"
    :class="
      raised
        ? 'bottom-[calc(env(safe-area-inset-bottom)+5rem)]'
        : 'bottom-[calc(env(safe-area-inset-bottom)+1rem)]'
    "
  >
    <Transition
      enter-from-class="translate-y-4 opacity-0"
      leave-to-class="translate-y-4 opacity-0"
      enter-active-class="transition duration-200 motion-reduce:transition-none"
      leave-active-class="transition duration-200 motion-reduce:transition-none"
    >
      <div
        v-if="notice !== 'none'"
        data-testid="offline-ready"
        class="bg-popover text-popover-foreground pointer-events-auto flex w-full items-start gap-3 rounded-lg border p-3 shadow-lg"
      >
        <CloudCheckIcon
          v-if="notice === 'ready'"
          class="text-primary mt-0.5 size-5 shrink-0"
          aria-hidden="true"
        />
        <LoaderCircleIcon
          v-else
          class="text-muted-foreground mt-0.5 size-5 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <p class="text-sm font-medium">
            {{ notice === 'ready' ? 'Ready to use offline' : 'Getting ready for offline…' }}
          </p>
          <p v-if="notice === 'busy'" class="text-muted-foreground text-xs">
            Keep MyVGC open until this is done.
          </p>
        </div>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -m-1 rounded p-1 outline-none focus-visible:ring-3"
          aria-label="Close"
          @click="notice = 'none'"
        >
          <XIcon class="size-4" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </div>
</template>
