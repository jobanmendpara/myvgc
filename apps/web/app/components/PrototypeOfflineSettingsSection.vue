<script setup lang="ts">
// PROTOTYPE (DEV-246), variant C: an Offline section on the Settings page, which always says
// whether this device is ready. The Account menu shows a dot until the User opens Settings.
import { CloudCheckIcon, CloudDownloadIcon, LoaderCircleIcon } from '@lucide/vue'
import { WORDINGS } from '@/composables/usePrototypeOfflineReady'

const { choices, phase, reason, done, total, percent, unseen } = usePrototypeOfflineReady()
const words = computed(() => WORDINGS[choices.value.wording])
// Before any Replay this device counts as ready from an earlier visit; during an update the old
// version still works offline.
const ready = computed(() => phase.value !== 'downloading' || reason.value === 'update')
onMounted(() => (unseen.value = false))
watch(phase, () => (unseen.value = false))
</script>

<template>
  <section
    v-if="choices.variant === 'C'"
    id="offline"
    aria-labelledby="offline-heading"
    class="flex scroll-mt-4 flex-col gap-4"
  >
    <div class="flex flex-col gap-1">
      <h2 id="offline-heading" class="text-lg font-semibold">Offline</h2>
      <p class="text-muted-foreground text-sm">
        MyVGC keeps its pages, Sprites and icons on this device, so it opens with no signal. Changes
        you make offline are sent once you're back online.
      </p>
    </div>
    <div class="flex items-start gap-3 rounded-lg border p-3" role="status">
      <CloudCheckIcon
        v-if="ready && phase !== 'downloading'"
        class="text-primary mt-0.5 size-5 shrink-0"
        aria-hidden="true"
      />
      <LoaderCircleIcon
        v-else-if="choices.progress !== 'count'"
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
          <template v-if="phase === 'downloading'">{{ words.downloading[reason] }}</template>
          <template v-else-if="phase === 'ready'">{{ words.ready[reason] }}</template>
          <template v-else>{{ words.ready.first }}</template>
        </p>
        <template v-if="phase === 'downloading' && choices.progress === 'count'">
          <div class="bg-muted h-1.5 overflow-hidden rounded-full">
            <div class="bg-primary h-full transition-[width]" :style="{ width: `${percent}%` }" />
          </div>
          <p class="text-muted-foreground text-xs tabular-nums">{{ done }} of {{ total }} files</p>
        </template>
        <p
          v-if="phase === 'downloading' && reason === 'update'"
          class="text-muted-foreground text-xs"
        >
          This version still works offline meanwhile.
        </p>
        <p v-else-if="phase === 'downloading'" class="text-muted-foreground text-xs">
          Keep MyVGC open until this is done.
        </p>
      </div>
    </div>
  </section>
</template>
