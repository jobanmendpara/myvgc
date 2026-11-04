<script setup lang="ts">
import type { Palette } from '@/lib/theme'

// The three main colours of a palette in one mode: its background, primary and accent. The
// attributes make the palette's own tokens apply here, whichever palette is active.
defineProps<{ palette: Palette; mode: 'light' | 'dark' }>()
</script>

<template>
  <span
    :data-palette="palette"
    :data-mode="mode"
    class="border-border inline-flex shrink-0 items-center gap-0.5 rounded-full border p-0.5"
    aria-hidden="true"
  >
    <span class="bg-background border-border size-3.5 rounded-full border" />
    <span class="bg-primary size-3.5 rounded-full" />
    <span class="bg-accent border-border size-3.5 rounded-full border" />
  </span>
</template>
