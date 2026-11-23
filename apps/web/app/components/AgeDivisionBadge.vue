<script setup lang="ts">
import type { AgeDivision } from '@myvgc/core/schema'

// An Opponent's Age Division (ADR 30): its first letter, or the whole word where there's room.
defineProps<{ ageDivision: AgeDivision; full?: boolean }>()
</script>

<template>
  <Badge variant="outline" :title="`${ageDivision} division`" data-testid="age-division">
    <template v-if="full">{{ ageDivision }}</template>
    <template v-else
      ><span aria-hidden="true">{{ ageDivision[0] }}</span
      ><span class="sr-only">{{ ageDivision }}</span></template
    >
  </Badge>
</template>
