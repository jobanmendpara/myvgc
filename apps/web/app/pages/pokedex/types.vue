<script setup lang="ts">
// PROTOTYPE (DEV-264), throwaway: never merge to main. Where the Types page sits; its own design
// is DEV-266's question.
import { TYPES } from '@myvgc/core/schema'
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-2xl font-semibold">Types</h1>
    <p class="text-muted-foreground text-sm">Placeholder: the type chart and two-type picker are DEV-266's prototype.</p>
    <div class="flex flex-wrap gap-1"><TypeIcon v-for="t in TYPES" :key="t.id" :type="t.id" labelled /></div>
  </div>
</template>
