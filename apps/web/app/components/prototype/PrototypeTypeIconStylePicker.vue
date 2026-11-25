<script setup lang="ts">
// PROTOTYPE (DEV-218): the Type icon style setting, with a preview of each option.
import { ICON_VARIANT_NAMES, ICON_VARIANTS } from '@/composables/usePrototypeIcons'

const { stored, setStyle } = usePrototypeIcons()
const sample = ['water', 'ghost']
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="mb-2 text-sm font-medium">Type icon style</legend>
    <p class="text-muted-foreground -mt-1 mb-1 text-sm">
      How a Pokémon's types and its moves' types show on its card.
    </p>
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <label
        v-for="style in ICON_VARIANTS"
        :key="style"
        class="has-checked:border-primary has-checked:bg-muted/50 flex cursor-pointer flex-col gap-3 rounded-lg border p-3"
      >
        <span class="flex items-center gap-2 text-sm font-medium">
          <input
            type="radio"
            name="type-icon-style"
            :value="style"
            :checked="stored === style"
            @change="setStyle(style)"
          />
          {{ ICON_VARIANT_NAMES[style] }}
          <span v-if="style === 'A'" class="text-muted-foreground font-normal">(default)</span>
        </span>
        <!-- Preview: Basculegion's corner and one move. -->
        <span class="flex items-start justify-between gap-2" aria-hidden="true">
          <span class="text-sm font-semibold">Basculegion</span>
          <span v-if="style === 'A'" class="flex gap-1">
            <PrototypeTypeIcon v-for="t in sample" :key="t" :type="t" :size="20" />
          </span>
          <span v-else-if="style === 'B'" class="flex flex-col gap-1">
            <PrototypeTypeIcon v-for="t in sample" :key="t" :type="t" :size="24" />
          </span>
          <span v-else class="flex flex-col items-end gap-1">
            <PrototypeTypeIcon v-for="t in sample" :key="t" :type="t" :size="18" label />
          </span>
        </span>
        <span aria-hidden="true" class="bg-muted flex items-stretch overflow-hidden rounded text-sm">
          <span v-if="style === 'B'" class="flex items-center bg-black/10 p-1 dark:bg-white/5">
            <PrototypeTypeIcon type="water" :size="20" />
          </span>
          <span class="flex items-center gap-1.5 px-2 py-1">
            <PrototypeTypeIcon v-if="style !== 'B'" type="water" :size="style === 'C' ? 18 : 16" />
            Wave Crash
          </span>
        </span>
      </label>
    </div>
  </fieldset>
</template>
