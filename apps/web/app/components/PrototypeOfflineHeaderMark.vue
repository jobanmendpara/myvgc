<script setup lang="ts">
// PROTOTYPE (DEV-246), variant B: a short line in the header, beside the Offline mark. While the
// files download it shows progress (unless Progress is None); once ready it says so for 6 seconds,
// then shrinks to a cloud mark that stays, so the User can always check.
import { CloudCheckIcon, CloudDownloadIcon, LoaderCircleIcon } from '@lucide/vue'
import { WORDINGS } from '@/composables/usePrototypeOfflineReady'

const { choices, phase, reason, percent, runId, shown } = usePrototypeOfflineReady()
const shrunkRun = ref(-1)
let timer: ReturnType<typeof setTimeout> | undefined
watch(phase, (now) => {
  clearTimeout(timer)
  if (now === 'ready') {
    const run = runId.value
    timer = setTimeout(() => (shrunkRun.value = run), 6000)
  }
})

const words = computed(() => WORDINGS[choices.value.wording])
const active = computed(() => choices.value.variant === 'B')
const downloading = computed(
  () => phase.value === 'downloading' && shown.value && choices.value.progress !== 'none',
)
const announcing = computed(
  () => phase.value === 'ready' && shown.value && shrunkRun.value !== runId.value,
)
// The lasting mark. Before any Replay this device counts as ready from an earlier visit; during
// an update the old version still works offline, so it stays.
const settled = computed(
  () =>
    !downloading.value &&
    !announcing.value &&
    (phase.value !== 'downloading' || reason.value === 'update'),
)
</script>

<template>
  <span
    v-if="active && downloading"
    role="status"
    class="text-muted-foreground inline-flex items-center gap-1 px-1 text-xs"
  >
    <LoaderCircleIcon
      v-if="choices.progress === 'busy'"
      class="size-3.5 animate-spin"
      aria-hidden="true"
    />
    <CloudDownloadIcon v-else class="size-3.5" aria-hidden="true" />
    <span class="hidden sm:inline">{{ words.downloading[reason] }}</span>
    <span v-if="choices.progress === 'count'" class="tabular-nums">{{ percent }}%</span>
  </span>
  <span
    v-else-if="active && announcing"
    role="status"
    class="text-primary inline-flex items-center gap-1 px-1 text-xs font-medium"
  >
    <CloudCheckIcon class="size-3.5" aria-hidden="true" /> {{ words.short }}
  </span>
  <span
    v-else-if="active && settled"
    class="text-muted-foreground inline-flex items-center px-1"
    :title="words.short"
  >
    <CloudCheckIcon class="size-4" :aria-label="words.short" />
  </span>
</template>
