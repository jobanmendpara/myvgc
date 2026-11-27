<script setup lang="ts">
// PROTOTYPE (DEV-265), throwaway: never merge to main. What a detail tooltip holds: a move's,
// item's or ability's details, or a Pokémon's Type matchups. `full` adds everything the Pokédex
// entry has; otherwise it's the short form.
import type { TypeId } from '@myvgc/core/schema'
import { entryPath, MULTIPLIER_LABELS, MULTIPLIERS, TARGET_LABELS, typeMatchups } from '@/composables/usePrototypePokedex'
import type { DetailKind } from '@/composables/usePrototypeTooltips'

const props = defineProps<{ kind: DetailKind; id?: string; types?: TypeId[]; full?: boolean; link?: boolean }>()
const names = useChampionsNames()
const pokedex = usePrototypePokedexData()
const n = computed(() => names.data.value)
const move = computed(() => (props.kind === 'moves' && props.id ? pokedex.data.value?.moves[props.id] : undefined))
const pa = computed(() => (props.id ? n.value?.powerAndAccuracy[props.id] : undefined))
const text = computed(() =>
  props.kind === 'items' || props.kind === 'abilities' ? pokedex.data.value?.[props.kind][props.id!] : undefined,
)
const matchups = computed(() =>
  props.kind === 'types' && pokedex.data.value ? typeMatchups(pokedex.data.value.typeChart, props.types ?? []) : undefined,
)
</script>

<template>
  <div v-if="n" class="flex flex-col gap-2 text-sm">
    <template v-if="kind === 'types' && matchups">
      <p class="text-muted-foreground text-xs font-medium">Damage taken</p>
      <dl class="flex flex-col gap-1">
        <template v-for="multiplier in MULTIPLIERS" :key="multiplier">
          <div v-if="matchups[multiplier]!.length" class="flex items-center gap-2">
            <dt
              class="w-7 shrink-0 text-xs font-semibold tabular-nums"
              :class="multiplier > 1 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'"
            >
              {{ MULTIPLIER_LABELS[multiplier] }}
            </dt>
            <dd class="flex flex-wrap gap-0.5">
              <TypeIcon v-for="type in matchups[multiplier]" :key="type" :type="type" :size="18" :labelled="full" />
            </dd>
          </div>
        </template>
      </dl>
    </template>

    <template v-else-if="kind === 'moves' && move && id">
      <div class="flex items-center gap-1.5">
        <TypeIcon :type="n.moveTypes[id]" :size="16" />
        <span class="font-semibold">{{ n.moves[id] }}</span>
      </div>
      <p class="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
        <span>{{ move.category }}</span>
        <span v-if="move.category !== 'Status'">Power {{ pa?.power ?? 'varies' }}</span>
        <span v-if="move.category !== 'Status'">Accuracy {{ pa?.accuracy ?? '—' }}</span>
        <span>PP {{ move.pp }}</span>
        <span v-if="move.priority">Priority {{ move.priority > 0 ? '+' : '' }}{{ move.priority }}</span>
      </p>
      <p>{{ move.shortDesc }}</p>
      <template v-if="full">
        <p class="text-muted-foreground text-xs">
          {{ TARGET_LABELS[move.target] ?? move.target }} · {{ move.contact ? 'Makes contact' : 'No contact' }}
        </p>
        <p v-if="move.desc !== move.shortDesc" class="text-muted-foreground text-xs leading-relaxed">{{ move.desc }}</p>
      </template>
    </template>

    <template v-else-if="text && id">
      <div class="flex items-center gap-1.5">
        <ItemIcon v-if="kind === 'items'" :item="id" />
        <span class="font-semibold">{{ n[kind as 'items' | 'abilities'][id] }}</span>
      </div>
      <p>{{ text.shortDesc }}</p>
      <p v-if="full && text.desc !== text.shortDesc" class="text-muted-foreground text-xs leading-relaxed">{{ text.desc }}</p>
    </template>

    <NuxtLink
      v-if="link && id && kind !== 'types'"
      :to="entryPath(kind, id)"
      class="text-primary self-start text-xs font-medium hover:underline"
    >
      Pokédex entry →
    </NuxtLink>
  </div>
  <p v-else class="text-muted-foreground text-xs">Loading…</p>
</template>
