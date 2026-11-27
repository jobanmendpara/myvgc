<script setup lang="ts">
// PROTOTYPE (DEV-266), throwaway: never merge to main. Defensive Type matchups for one or two
// types, and (with `offense`) what each type hits.
import type { TypeId } from '@myvgc/core/schema'
import { typeName } from '@myvgc/core/schema'
import { MULTIPLIER_LABELS, MULTIPLIERS, typeMatchups } from '@/composables/usePrototypePokedex'
import { offense } from '@/composables/usePrototypeTypes'

const props = defineProps<{ types: TypeId[]; showOffense?: boolean; labelled?: boolean }>()
const pokedex = usePrototypePokedexData()
const matchups = computed(() => (pokedex.data.value ? typeMatchups(pokedex.data.value.typeChart, props.types) : undefined))
const hits = computed(() => (pokedex.data.value ? props.types.map((t) => ({ type: t, rows: offense(pokedex.data.value!.typeChart, t) })) : []))
const OFFENSE_LABELS: Record<number, string> = { 2: 'Super effective (×2)', 0.5: 'Not very effective (×½)', 0: 'No effect (×0)' }
</script>

<template>
  <div v-if="matchups" class="flex flex-col gap-5">
    <section class="flex flex-col gap-2">
      <h2 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Type matchups <span class="font-normal normal-case">(damage taken)</span>
      </h2>
      <dl class="flex flex-col gap-1.5">
        <template v-for="multiplier in MULTIPLIERS" :key="multiplier">
          <div v-if="matchups[multiplier]!.length" class="flex items-start gap-3">
            <dt class="w-8 shrink-0 pt-0.5 text-sm font-semibold tabular-nums" :class="multiplier > 1 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'">
              {{ MULTIPLIER_LABELS[multiplier] }}
            </dt>
            <dd class="flex flex-wrap gap-1"><TypeIcon v-for="t in matchups[multiplier]" :key="t" :type="t" :labelled="labelled" /></dd>
          </div>
        </template>
      </dl>
    </section>
    <section v-for="{ type, rows } in showOffense ? hits : []" :key="type" class="flex flex-col gap-2">
      <h2 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{{ typeName(type) }} attacks</h2>
      <dl class="flex flex-col gap-1.5">
        <template v-for="value in [2, 0.5, 0]" :key="value">
          <div v-if="rows[value]!.length" class="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
            <dt class="text-muted-foreground w-44 shrink-0 text-xs sm:pt-1">{{ OFFENSE_LABELS[value] }}</dt>
            <dd class="flex flex-wrap gap-1"><TypeIcon v-for="t in rows[value]" :key="t" :type="t" :labelled="labelled" /></dd>
          </div>
        </template>
      </dl>
    </section>
  </div>
</template>
