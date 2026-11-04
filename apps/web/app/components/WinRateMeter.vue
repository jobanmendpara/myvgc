<script setup lang="ts">
import type { Rate } from '@myvgc/core/schema'
import { formatRecord } from '@myvgc/core/schema'

// A win rate as a meter: one accent hue on a lighter track of the same hue, with the
// rate and record printed beside it so nothing depends on reading the bar.
const props = defineProps<{ label: string; rate: Rate }>()
const played = computed(() => props.rate.wins + props.rate.losses + props.rate.ties)
const percent = computed(() =>
  props.rate.winRate === null ? null : Math.round(props.rate.winRate * 100),
)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-baseline justify-between gap-3 text-sm">
      <span class="min-w-0 truncate">{{ props.label }}</span>
      <span class="shrink-0 tabular-nums">
        <span class="font-semibold">{{ percent === null ? '—' : `${percent}%` }}</span>
        <span class="text-muted-foreground"> · {{ formatRecord(props.rate) }}</span>
      </span>
    </div>
    <div
      class="bg-primary/15 h-2 overflow-hidden rounded-full"
      role="meter"
      :aria-label="`${props.label} win rate`"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="percent ?? undefined"
      :aria-valuetext="
        percent === null
          ? 'No Rounds'
          : `${percent}%, ${formatRecord(props.rate)} in ${played} Rounds`
      "
    >
      <div class="bg-primary h-full rounded-full" :style="{ width: `${percent ?? 0}%` }" />
    </div>
  </div>
</template>
