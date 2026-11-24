<script setup lang="ts">
import { useOnline } from '@vueuse/core'

useHead({ title: 'New Team · MyVGC' })
// Building works with no signal; importing and reading need the server (ADR 17).
const online = useOnline()

// Reading images is only offered when the install has it turned on (ADR 24).
const imageReading = useImageReading()

const WAYS = computed(() => [
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
  ...(imageReading.value
    ? [
        {
          to: '/teams/new/images',
          title: 'Read screenshots',
          description:
            'Choose screenshots of a Replica Team or Pokémon detail screens, then check what was read.',
        },
      ]
    : []),
])
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <ListBackLink to="/teams">Your Teams</ListBackLink>
    <h1 class="text-2xl font-semibold">New Team</h1>
    <p v-if="!online" class="text-muted-foreground text-sm" role="status">
      No signal. You can still build a Team; importing a paste and reading a file need a connection.
    </p>
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
