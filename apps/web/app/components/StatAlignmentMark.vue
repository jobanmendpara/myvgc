<script setup lang="ts">
import { type StatId, statAlignmentEffect } from '@myvgc/core/schema'

/** ▲ by the stat a Stat Alignment raises, ▼ by the one it lowers, in words for screen readers. */
const props = defineProps<{ statAlignment?: string; stat: StatId }>()
const effect = computed(() => statAlignmentEffect(props.statAlignment || undefined, props.stat))
</script>

<template>
  <span v-if="effect === 'raises'" class="text-red-600 dark:text-red-400"
    ><span aria-hidden="true">▲</span><span class="sr-only">raised by Stat Alignment</span></span
  >
  <span v-else-if="effect === 'lowers'" class="text-blue-600 dark:text-blue-400"
    ><span aria-hidden="true">▼</span><span class="sr-only">lowered by Stat Alignment</span></span
  >
</template>
