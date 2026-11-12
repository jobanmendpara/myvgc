<script setup lang="ts">
import { ScanSearchIcon } from '@lucide/vue'

// What the reader wasn't sure of on one Pokémon build read from a file (ADR 24).
defineProps<{ flags: string[] }>()
</script>

<template>
  <ul
    v-if="flags.length"
    class="text-muted-foreground flex flex-col gap-1 text-sm"
    data-testid="read-flags"
  >
    <li v-for="flag in flags" :key="flag" class="flex items-start gap-1.5">
      <ScanSearchIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {{ flag }}
    </li>
  </ul>
</template>
