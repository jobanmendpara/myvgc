<script setup lang="ts">
// PROTOTYPE (DEV-264), throwaway: never merge to main. An item's or ability's Pokédex entry:
// they show the same things, plus a Mega Stone's Mega, or an ability's Pokémon.
import { spriteUrl } from '@/lib/sprites'
import { entryPath } from '@/composables/usePrototypePokedex'

const props = defineProps<{ kind: 'items' | 'abilities'; id: string }>()
const names = useChampionsNames()
const pokedex = usePrototypePokedexData()
const { links } = usePrototypePokedexBar()
const to = usePokedexLink()

const entry = computed(() => pokedex.data.value?.[props.kind][props.id])
const megaFor = computed(() =>
  props.kind === 'items' ? pokedex.data.value?.items[props.id]?.megaFor : undefined,
)
const withAbility = computed(() => {
  if (props.kind !== 'abilities' || !names.data.value) return []
  return Object.entries(names.data.value.abilitiesBySpecies)
    .filter(([, abilities]) => abilities.includes(props.id))
    .map(([id]) => ({ id, name: names.data.value!.species[id] ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name))
})
</script>

<template>
  <article v-if="names.data.value && entry" class="flex flex-col gap-5">
    <header class="flex items-center gap-3">
      <ItemIcon v-if="kind === 'items'" :item="id" :size="40" />
      <div class="flex flex-col">
        <span class="text-muted-foreground text-xs">{{ kind === 'items' ? 'Item' : 'Ability' }}</span>
        <h1 class="text-2xl font-semibold">{{ names.data.value[kind][id] }}</h1>
      </div>
    </header>

    <p class="text-base">{{ entry.shortDesc }}</p>

    <section v-if="entry.desc !== entry.shortDesc" class="flex flex-col gap-1">
      <h2 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">In detail</h2>
      <p class="text-muted-foreground text-sm leading-relaxed">{{ entry.desc }}</p>
    </section>

    <section v-if="megaFor" class="flex flex-col gap-2">
      <h2 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Mega Evolution</h2>
      <NuxtLink :to="to(entryPath('species', megaFor))" class="flex items-center gap-2 font-medium hover:underline">
        <img :src="spriteUrl(megaFor)" alt="" width="48" height="48" />{{ names.data.value.species[megaFor] }}
      </NuxtLink>
    </section>

    <section v-if="links && withAbility.length" class="flex flex-col gap-2">
      <h2 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Pokémon with this ability ({{ withAbility.length }})
      </h2>
      <ul class="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-3 gap-y-0.5 text-sm">
        <li v-for="species in withAbility" :key="species.id">
          <NuxtLink :to="to(entryPath('species', species.id))" class="flex items-center gap-1 hover:underline">
            <img :src="spriteUrl(species.id)" alt="" width="28" height="28" loading="lazy" />{{ species.name }}
          </NuxtLink>
        </li>
      </ul>
    </section>
  </article>
</template>
