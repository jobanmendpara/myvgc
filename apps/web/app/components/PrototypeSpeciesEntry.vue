<script setup lang="ts">
// PROTOTYPE (DEV-264), throwaway: never merge to main. A species' or form's Pokédex entry.
// `compact` is the form that would sit in the build editor's third column.
import type { TypeId } from '@myvgc/core/schema'
import { spriteUrl } from '@/lib/sprites'
import {
  entryPath,
  MULTIPLIER_LABELS,
  MULTIPLIERS,
  STAT_LABELS,
  typeMatchups,
  weightPower,
} from '@/composables/usePrototypePokedex'

const props = defineProps<{ id: string; compact?: boolean }>()
const names = useChampionsNames()
const pokedex = usePrototypePokedexData()
const { links } = usePrototypePokedexBar()
const to = usePokedexLink()

const entry = computed(() => pokedex.data.value?.species[props.id])
const types = computed<TypeId[]>(() => names.data.value?.typesBySpecies[props.id] ?? [])
const stats = computed(() => names.data.value?.baseStats[props.id])
const total = computed(() => (stats.value ? Object.values(stats.value).reduce((a, b) => a + b, 0) : 0))
const matchups = computed(() =>
  pokedex.data.value ? typeMatchups(pokedex.data.value.typeChart, types.value) : undefined,
)
const SLOT_LABELS: Record<string, string> = { 0: '', 1: '', H: 'Hidden', S: 'Special' }

// Learnset grouped by move type, damaging moves first by power.
const learnset = computed(() => {
  const moves = entry.value?.learnset ?? []
  const n = names.data.value
  if (!n) return []
  return [...moves]
    .map((id) => ({ id, name: n.moves[id] ?? id, type: n.moveTypes[id], power: n.powerAndAccuracy[id]?.power ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name))
})
const learnsetOpen = ref(false)
const statBar = (value: number) => `${Math.min(100, (value / 200) * 100)}%`
const statColor = (value: number) =>
  value < 60 ? 'bg-red-400' : value < 90 ? 'bg-amber-400' : value < 120 ? 'bg-lime-500' : 'bg-emerald-500'
</script>

<template>
  <article v-if="names.data.value" class="flex flex-col" :class="compact ? 'gap-4 text-sm' : 'gap-6'">
    <header class="flex items-center gap-3">
      <img
        :src="spriteUrl(id)"
        alt=""
        :width="compact ? 56 : 96"
        :height="compact ? 56 : 96"
        class="shrink-0 object-contain"
      />
      <div class="flex min-w-0 flex-col gap-1.5">
        <h1 :class="compact ? 'text-lg font-semibold' : 'text-2xl font-semibold'">
          {{ names.data.value.species[id] }}
        </h1>
        <div class="flex flex-wrap gap-1">
          <TypeIcon v-for="type in types" :key="type" :type="type" labelled />
        </div>
      </div>
    </header>

    <div v-if="entry && entry.forms.length > 1 && !compact" class="flex flex-wrap gap-1.5">
      <NuxtLink
        v-for="form in entry.forms"
        :key="form"
        :to="to(entryPath('species', form))"
        class="flex items-center gap-1 rounded-full border py-0.5 pr-2.5 pl-1 text-xs"
        :class="form === id ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted'"
      >
        <img :src="spriteUrl(form)" alt="" width="24" height="24" />
        {{ names.data.value.species[form] }}
      </NuxtLink>
    </div>

    <section v-if="entry?.requiredItem" class="flex items-center gap-2 text-sm">
      <span class="text-muted-foreground">Mega Evolves with</span>
      <NuxtLink :to="to(entryPath('items', entry.requiredItem))" class="flex items-center gap-1 font-medium hover:underline">
        <ItemIcon :item="entry.requiredItem" />{{ names.data.value.items[entry.requiredItem] }}
      </NuxtLink>
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Abilities</h2>
      <ul class="flex flex-col gap-1.5">
        <li v-for="(ability, slot) in entry?.abilitySlots" :key="slot" class="flex flex-col">
          <span class="flex items-baseline gap-2">
            <NuxtLink :to="to(entryPath('abilities', ability))" class="font-medium hover:underline">
              {{ names.data.value.abilities[ability] }}
            </NuxtLink>
            <span v-if="SLOT_LABELS[slot]" class="text-muted-foreground text-xs">{{ SLOT_LABELS[slot] }}</span>
          </span>
          <span class="text-muted-foreground text-sm">{{ pokedex.data.value?.abilities[ability]?.shortDesc }}</span>
        </li>
      </ul>
    </section>

    <section v-if="stats" class="flex flex-col gap-2">
      <h2 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Base stats</h2>
      <dl class="grid grid-cols-[auto_2.5rem_1fr] items-center gap-x-3 gap-y-1 text-sm">
        <template v-for="(label, stat) in STAT_LABELS" :key="stat">
          <dt class="text-muted-foreground">{{ label }}</dt>
          <dd class="text-right font-medium tabular-nums">{{ stats[stat] }}</dd>
          <dd class="bg-muted h-2 overflow-hidden rounded-full">
            <div class="h-full rounded-full" :class="statColor(stats[stat])" :style="{ width: statBar(stats[stat]) }" />
          </dd>
        </template>
        <dt class="text-muted-foreground">Total</dt>
        <dd class="text-right font-semibold tabular-nums">{{ total }}</dd>
        <dd />
      </dl>
    </section>

    <section v-if="matchups" class="flex flex-col gap-2">
      <h2 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Type matchups <span class="font-normal normal-case">(damage taken)</span>
      </h2>
      <dl class="flex flex-col gap-1.5">
        <template v-for="multiplier in MULTIPLIERS" :key="multiplier">
          <div v-if="matchups[multiplier]!.length" class="flex items-start gap-3">
            <dt
              class="w-8 shrink-0 pt-0.5 text-sm font-semibold tabular-nums"
              :class="multiplier > 1 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'"
            >
              {{ MULTIPLIER_LABELS[multiplier] }}
            </dt>
            <dd class="flex flex-wrap gap-1">
              <TypeIcon
                v-for="type in matchups[multiplier]"
                :key="type"
                :type="type"
                :labelled="!compact"
              />
            </dd>
          </div>
        </template>
      </dl>
    </section>

    <section v-if="entry" class="flex flex-col gap-1 text-sm">
      <h2 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Weight</h2>
      <p>
        {{ entry.weightkg }} kg
        <span class="text-muted-foreground">· Low Kick and Grass Knot: {{ weightPower(entry.weightkg) }} power</span>
      </p>
    </section>

    <section v-if="links && entry && !compact" class="flex flex-col gap-2">
      <button
        type="button"
        class="text-muted-foreground flex items-center gap-1 text-left text-xs font-semibold tracking-wide uppercase"
        @click="learnsetOpen = !learnsetOpen"
      >
        {{ learnsetOpen ? '▾' : '▸' }} Moves it can learn ({{ learnset.length }})
      </button>
      <ul v-if="learnsetOpen" class="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-3 gap-y-1 text-sm">
        <li v-for="move in learnset" :key="move.id">
          <NuxtLink :to="to(entryPath('moves', move.id))" class="flex items-center gap-1.5 hover:underline">
            <TypeIcon :type="move.type" :size="16" />{{ move.name }}
          </NuxtLink>
        </li>
      </ul>
    </section>
  </article>
</template>
