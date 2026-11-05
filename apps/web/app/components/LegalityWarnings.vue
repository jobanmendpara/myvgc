<script setup lang="ts">
import { TriangleAlertIcon } from '@lucide/vue'
import type { LegalityProblem } from '@myvgc/core/schema'

defineProps<{ problems: LegalityProblem[] }>()
</script>

<template>
  <ul class="flex flex-col gap-1 text-sm" data-testid="legality-warnings">
    <li v-for="problem in problems" :key="problem.message" class="flex items-start gap-1.5">
      <TriangleAlertIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {{ problem.message }}
    </li>
  </ul>
</template>
