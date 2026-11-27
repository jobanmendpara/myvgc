<script setup lang="ts">
// PROTOTYPE (DEV-264), throwaway: never merge to main. The Pokédex area, in three variants
// switched by `?variant=` and the floating bar.
definePageMeta({ listDetail: true })
useHead({ title: 'Pokédex · MyVGC' })
const { variant } = usePrototypePokedexBar()
usePrototypePokedexData()
</script>

<template>
  <PrototypePokedexBrowse v-if="variant === 'C'"><NuxtPage /></PrototypePokedexBrowse>
  <ListDetail v-else base="/pokedex" label="Pokédex" placeholder="Search for a Pokémon, move, item or ability">
    <template #list="{ wide }">
      <PrototypePokedexGrouped v-if="variant === 'A'" :wide="wide" />
      <PrototypePokedexTabs v-else :wide="wide" />
    </template>
    <NuxtPage />
  </ListDetail>
  <PrototypePokedexBar />
</template>
