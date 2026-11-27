<script setup lang="ts">
// PROTOTYPE (DEV-266), throwaway: never merge to main. The 18 × 18 type chart: attacking types
// down the side, defending across the top, both headers sticky while it scrolls. Picked types'
// columns are highlighted.
import { TYPES } from '@myvgc/core/schema'
import { CELL_CLASSES, CELL_LABELS, effectiveness } from '@/composables/usePrototypeTypes'

const pokedex = usePrototypePokedexData()
const { picked } = usePickedTypes()
const hover = ref<{ a: string; d: string } | null>(null)
</script>

<template>
  <div v-if="pokedex.data.value" class="flex flex-col gap-2">
    <p class="text-muted-foreground text-xs">Attacking type down the side, defending type across the top.</p>
    <div class="max-h-[70dvh] max-w-full overflow-auto rounded-md border">
      <table class="border-separate border-spacing-0 text-xs" @mouseleave="hover = null">
        <thead>
          <tr>
            <th class="bg-background sticky top-0 left-0 z-20 border-r border-b p-1 text-[0.625rem] font-normal text-muted-foreground">Atk ↓ Def →</th>
            <th
              v-for="d in TYPES"
              :key="d.id"
              class="bg-background sticky top-0 z-10 border-b p-1"
              :class="{ 'bg-primary/15': picked.includes(d.id) || hover?.d === d.id }"
            >
              <TypeIcon :type="d.id" :size="22" class="mx-auto" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in TYPES" :key="a.id">
            <th class="bg-background sticky left-0 z-10 border-r p-1" :class="{ 'bg-primary/15': hover?.a === a.id }">
              <TypeIcon :type="a.id" :size="22" />
            </th>
            <td
              v-for="d in TYPES"
              :key="d.id"
              class="size-8 min-w-8 border-b border-l border-black/5 text-center tabular-nums dark:border-white/5"
              :class="[
                CELL_CLASSES[effectiveness(pokedex.data.value.typeChart, a.id, d.id)],
                (picked.includes(d.id) || hover?.d === d.id || hover?.a === a.id) && effectiveness(pokedex.data.value.typeChart, a.id, d.id) === 1 ? 'bg-primary/10' : '',
              ]"
              :title="`${a.name} → ${d.name}: ×${effectiveness(pokedex.data.value.typeChart, a.id, d.id)}`"
              @mouseenter="hover = { a: a.id, d: d.id }"
            >
              {{ CELL_LABELS[effectiveness(pokedex.data.value.typeChart, a.id, d.id)] }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
