<script setup lang="ts">
// PROTOTYPE (DEV-264), throwaway: never merge to main. The Pokédex area, in three variants
// switched by `?variant=` and the floating bar.
definePageMeta({ listDetail: true })
useHead({ title: 'Pokédex · MyVGC' })

usePrototypePokedexData()
</script>

<template>
  
  <ListDetail base="/pokedex" label="Pokédex" placeholder="Search for a Pokémon, move, item or ability">
    <template #list="{ wide }">
      
      <PrototypePokedexTabs :wide="wide" />
    </template>
    <NuxtPage />
  </ListDetail>
  <PrototypeTypesBar />
</template>
