<script setup lang="ts">
import type { Legality } from '@myvgc/core/schema'

// A legal Team gets no badge, and an unchecked one is never shown as legal (ADR 18).
defineProps<{ legality: Legality }>()
</script>

<template>
  <Badge v-if="legality.status === 'illegal'" variant="destructive" data-testid="legality-badge">
    Illegal in {{ legality.regulation }}
  </Badge>
  <Badge v-else-if="legality.status === 'unchecked'" variant="outline" data-testid="legality-badge">
    Not checked
  </Badge>
</template>
