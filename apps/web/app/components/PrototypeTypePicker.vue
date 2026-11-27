<script setup lang="ts">
// PROTOTYPE (DEV-266), throwaway: never merge to main. Picks up to two types. `pills` shows
// each type's name too; otherwise a compact grid of Type icons.
import { TYPES } from '@myvgc/core/schema'

defineProps<{ pills?: boolean }>()
const { picked, toggle } = usePickedTypes()
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2 text-sm">
      <span class="text-muted-foreground">Pick one or two types</span>
      <button v-if="picked.length" type="button" class="text-primary text-xs hover:underline" @click="picked = []">Clear</button>
    </div>
    <div class="flex flex-wrap" :class="pills ? 'gap-1.5' : 'gap-1'">
      <button
        v-for="type in TYPES"
        :key="type.id"
        type="button"
        :aria-pressed="picked.includes(type.id)"
        :aria-label="pills ? undefined : type.name"
        :title="type.name"
        class="rounded-full transition"
        :class="[
          picked.includes(type.id) ? 'ring-primary ring-2 ring-offset-1' : picked.length === 2 ? 'opacity-40' : '',
          pills ? '' : 'p-0.5',
        ]"
        @click="toggle(type.id)"
      >
        <TypeIcon :type="type.id" :size="pills ? 22 : 28" :labelled="pills" />
      </button>
    </div>
  </div>
</template>
