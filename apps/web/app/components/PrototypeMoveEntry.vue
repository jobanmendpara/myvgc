<script setup lang="ts">
// PROTOTYPE (DEV-264), throwaway: never merge to main. A move's Pokédex entry.
import { spriteUrl } from '@/lib/sprites'
import { entryPath, TARGET_LABELS } from '@/composables/usePrototypePokedex'

const props = defineProps<{ id: string; compact?: boolean }>()
const names = useChampionsNames()
const pokedex = usePrototypePokedexData()
const { links } = usePrototypePokedexBar()
const to = usePokedexLink()

const move = computed(() => pokedex.data.value?.moves[props.id])
const pa = computed(() => names.data.value?.powerAndAccuracy[props.id])
const learnedBy = computed(() => {
  const species = pokedex.data.value?.species ?? {}
  return Object.entries(species)
    .filter(([, entry]) => entry.learnset.includes(props.id))
    .map(([id]) => ({ id, name: names.data.value?.species[id] ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name))
})
const learnedOpen = ref(false)
const CATEGORY_CLASSES = {
  Physical: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  Special: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  Status: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
}
</script>

<template>
  <article v-if="names.data.value && move" class="flex flex-col gap-5">
    <header class="flex flex-col gap-2">
      <h1 class="text-2xl font-semibold">{{ names.data.value.moves[id] }}</h1>
      <div class="flex flex-wrap items-center gap-1.5">
        <TypeIcon :type="names.data.value.moveTypes[id]" labelled />
        <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="CATEGORY_CLASSES[move.category]">
          {{ move.category }}
        </span>
        <span v-if="move.priority" class="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900 dark:bg-violet-950 dark:text-violet-200">
          Priority {{ move.priority > 0 ? '+' : '' }}{{ move.priority }}
        </span>
      </div>
    </header>

    <dl class="grid grid-cols-3 gap-2 text-center">
      <div class="bg-muted rounded-lg p-2">
        <dt class="text-muted-foreground text-xs">Power</dt>
        <dd class="text-lg font-semibold tabular-nums">{{ move.category === 'Status' ? '—' : (pa?.power ?? 'Varies') }}</dd>
      </div>
      <div class="bg-muted rounded-lg p-2">
        <dt class="text-muted-foreground text-xs">Accuracy</dt>
        <dd class="text-lg font-semibold tabular-nums">{{ pa ? (pa.accuracy ?? '—') : '—' }}</dd>
      </div>
      <div class="bg-muted rounded-lg p-2">
        <dt class="text-muted-foreground text-xs">PP</dt>
        <dd class="text-lg font-semibold tabular-nums">{{ move.pp }}</dd>
      </div>
    </dl>

    <p class="text-base">{{ move.shortDesc }}</p>

    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt class="text-muted-foreground">Target</dt>
      <dd>{{ TARGET_LABELS[move.target] ?? move.target }}</dd>
      <dt class="text-muted-foreground">Contact</dt>
      <dd>{{ move.contact ? 'Makes contact' : 'No contact' }}</dd>
    </dl>

    <section v-if="move.desc !== move.shortDesc" class="flex flex-col gap-1">
      <h2 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">In detail</h2>
      <p class="text-muted-foreground text-sm leading-relaxed">{{ move.desc }}</p>
    </section>

    <section v-if="links" class="flex flex-col gap-2">
      <button
        type="button"
        class="text-muted-foreground flex items-center gap-1 text-left text-xs font-semibold tracking-wide uppercase"
        @click="learnedOpen = !learnedOpen"
      >
        {{ learnedOpen ? '▾' : '▸' }} Pokémon that learn it ({{ learnedBy.length }})
      </button>
      <ul v-if="learnedOpen" class="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-3 gap-y-0.5 text-sm">
        <li v-for="species in learnedBy" :key="species.id">
          <NuxtLink :to="to(entryPath('species', species.id))" class="flex items-center gap-1 hover:underline">
            <img :src="spriteUrl(species.id)" alt="" width="28" height="28" loading="lazy" />{{ species.name }}
          </NuxtLink>
        </li>
      </ul>
    </section>
  </article>
</template>
