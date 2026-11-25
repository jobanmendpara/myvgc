<script setup lang="ts">
// PROTOTYPE (DEV-218): the page's Type icon style and move layout, under the Sprite style in the
// header's dialog. Each option previews Basculegion's corner and its moves.
import {
  ICON_VARIANT_NAMES,
  ICON_VARIANTS,
  MOVE_LAYOUT_NAMES,
  MOVE_LAYOUTS,
} from '@/composables/usePrototypeIcons'

const { stored, setStyle, moveLayout, setMoveLayout } = usePrototypeIcons()
const sample = ['water', 'ghost']
const moves = [
  { name: 'Wave Crash', type: 'water', pa: '120/100' },
  { name: 'Last Respects', type: 'ghost', pa: '50/100' },
]
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="mb-2 text-sm font-medium">Type icons</legend>
    <label
      v-for="style in ICON_VARIANTS"
      :key="style"
      class="has-[:checked]:border-primary has-[:checked]:bg-primary/5 flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3"
    >
      <input
        type="radio"
        class="sr-only"
        name="type-icon-style"
        :checked="stored === style"
        @change="setStyle(style)"
      />
      <span class="text-sm font-medium">{{ ICON_VARIANT_NAMES[style] }}</span>
      <span aria-hidden="true" class="flex items-center gap-3">
        <span v-if="style === 'A'" class="flex gap-1">
          <PrototypeTypeIcon v-for="t in sample" :key="t" :type="t" :size="20" />
        </span>
        <span v-else-if="style === 'B'" class="flex flex-col gap-1">
          <PrototypeTypeIcon v-for="t in sample" :key="t" :type="t" :size="24" />
        </span>
        <span v-else class="flex flex-col items-end gap-1">
          <PrototypeTypeIcon v-for="t in sample" :key="t" :type="t" :size="18" label />
        </span>
        <span class="bg-muted flex w-32 items-stretch overflow-hidden rounded text-sm">
          <span v-if="style === 'B'" class="flex items-center bg-black/10 p-1 dark:bg-white/5">
            <PrototypeTypeIcon type="water" :size="20" />
          </span>
          <span class="flex items-center gap-1.5 px-2 py-1 whitespace-nowrap">
            <PrototypeTypeIcon v-if="style !== 'B'" type="water" :size="style === 'C' ? 18 : 16" />
            Wave Crash
          </span>
        </span>
      </span>
    </label>
  </fieldset>

  <fieldset class="flex flex-col gap-2">
    <legend class="mb-2 text-sm font-medium">Moves</legend>
    <label
      v-for="layout in MOVE_LAYOUTS"
      :key="layout"
      class="has-[:checked]:border-primary has-[:checked]:bg-primary/5 flex cursor-pointer flex-col gap-2 rounded-lg border p-3"
    >
      <input
        type="radio"
        class="sr-only"
        name="move-layout"
        :checked="moveLayout === layout"
        @change="setMoveLayout(layout)"
      />
      <span class="text-sm font-medium">
        {{ MOVE_LAYOUT_NAMES[layout] }}
        <span class="text-muted-foreground font-normal">{{
          layout === 'list' ? 'with power and accuracy' : 'more compact'
        }}</span>
      </span>
      <span
        aria-hidden="true"
        class="grid gap-1 text-sm"
        :class="layout === 'list' ? 'grid-cols-1' : 'grid-cols-2'"
      >
        <span
          v-for="move in moves"
          :key="move.name"
          class="bg-muted flex items-center gap-1.5 rounded px-2 py-1 whitespace-nowrap"
        >
          <PrototypeTypeIcon :type="move.type" :size="16" />
          <span class="min-w-0 flex-1 truncate">{{ move.name }}</span>
          <span v-if="layout === 'list'" class="text-muted-foreground text-xs tabular-nums">{{
            move.pa
          }}</span>
        </span>
      </span>
    </label>
  </fieldset>
</template>
