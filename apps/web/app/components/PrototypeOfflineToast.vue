<script setup lang="ts">
// PROTOTYPE (DEV-246), variant A: a card in the corner, raised here only to clear the prototype
// bar. It shows while the files download (when Progress isn't None), says it's ready, and goes
// after 8 seconds or when closed.
import { CloudCheckIcon, CloudDownloadIcon, LoaderCircleIcon, XIcon } from '@lucide/vue'
import { WORDINGS } from '@/composables/usePrototypeOfflineReady'

const { choices, phase, reason, done, total, percent, runId, shown } = usePrototypeOfflineReady()
const closedRun = ref(-1)
const expiredRun = ref(-1)
let timer: ReturnType<typeof setTimeout> | undefined
watch(phase, (now) => {
  clearTimeout(timer)
  if (now === 'ready') {
    const run = runId.value
    timer = setTimeout(() => (expiredRun.value = run), 8000)
  }
})

const words = computed(() => WORDINGS[choices.value.wording])
const visible = computed(() => {
  if (choices.value.variant !== 'A' || !shown.value || phase.value === 'idle') return false
  if (closedRun.value === runId.value || expiredRun.value === runId.value) return false
  return phase.value === 'ready' || choices.value.progress !== 'none'
})
</script>

<template>
  <Transition
    enter-from-class="translate-y-4 opacity-0"
    leave-to-class="translate-y-4 opacity-0"
    enter-active-class="transition duration-200"
    leave-active-class="transition duration-200"
  >
    <div
      v-if="visible"
      role="status"
      class="bg-popover text-popover-foreground fixed right-4 bottom-56 left-4 sm:bottom-32 z-50 flex items-start gap-3 rounded-lg border p-3 shadow-lg sm:left-auto sm:w-80"
    >
      <CloudCheckIcon
        v-if="phase === 'ready'"
        class="text-primary mt-0.5 size-5 shrink-0"
        aria-hidden="true"
      />
      <LoaderCircleIcon
        v-else-if="choices.progress === 'busy'"
        class="text-muted-foreground mt-0.5 size-5 shrink-0 animate-spin"
        aria-hidden="true"
      />
      <CloudDownloadIcon
        v-else
        class="text-muted-foreground mt-0.5 size-5 shrink-0"
        aria-hidden="true"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        <p class="text-sm font-medium">
          {{ phase === 'ready' ? words.ready[reason] : words.downloading[reason] }}
        </p>
        <template v-if="phase === 'downloading' && choices.progress === 'count'">
          <div class="bg-muted h-1.5 overflow-hidden rounded-full">
            <div class="bg-primary h-full transition-[width]" :style="{ width: `${percent}%` }" />
          </div>
          <p class="text-muted-foreground text-xs tabular-nums">{{ done }} of {{ total }} files</p>
        </template>
        <p v-else-if="phase === 'downloading'" class="text-muted-foreground text-xs">
          Keep MyVGC open until this is done.
        </p>
      </div>
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground -m-1 p-1"
        aria-label="Close"
        @click="closedRun = runId"
      >
        <XIcon class="size-4" aria-hidden="true" />
      </button>
    </div>
  </Transition>
</template>
