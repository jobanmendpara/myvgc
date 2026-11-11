<script setup lang="ts">
useHead({ title: 'New Team · MyVGC' })

const WAYS = [
  {
    to: '/teams/new/paste',
    title: 'Import a paste',
    description: 'Paste a Pokémon Champions Team exported from Showdown.',
  },
  {
    to: '/teams/new/build',
    title: 'Build',
    description: 'Choose each Pokémon yourself. Only the species is required.',
  },
  {
    to: '/teams/new/teamsheet',
    title: 'Read a Teamsheet',
    description: 'Choose a Teamsheet PDF filled in on teamsheet.gg, then check what was read.',
  },
]
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <ListBackLink to="/teams">Your Teams</ListBackLink>
    <h1 class="text-2xl font-semibold">New Team</h1>
    <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <li v-for="way in WAYS" :key="way.to">
        <NuxtLink
          :to="way.to"
          class="hover:bg-muted focus-visible:ring-ring/50 flex h-full flex-col gap-1 rounded-lg border p-4 outline-none focus-visible:ring-3"
        >
          <span class="font-medium">{{ way.title }}</span>
          <span class="text-muted-foreground text-sm">{{ way.description }}</span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
