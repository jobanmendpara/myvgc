<script setup lang="ts">
// PROTOTYPE (DEV-267), throwaway: never merge to main. The slots while a build is open on
// desktop: a rail down the side (B) or a strip across the top (C). The edited one is
// highlighted; clicking another switches the editor to it.
import { MAX_TEAM_SIZE } from '@myvgc/core/schema'
import { spriteUrl } from '@/lib/sprites'
import type { BuildDraft } from '@/lib/team-form'

defineProps<{ builds: BuildDraft[]; editing: number; layout: 'rail' | 'strip'; teamName: string }>()
const emit = defineEmits<{ edit: [index: number]; add: []; done: [] }>()
const names = useChampionsNames()
</script>

<template>
  <nav aria-label="Pokémon" class="flex gap-2" :class="layout === 'rail' ? 'flex-col' : 'flex-row flex-wrap items-stretch'">
    <p v-if="layout === 'rail'" class="text-muted-foreground truncate text-sm">{{ teamName || 'This Team' }}</p>
    <button
      v-for="(build, index) in builds"
      :key="build.key"
      type="button"
      :aria-current="index === editing ? 'true' : undefined"
      class="hover:bg-muted flex items-center gap-2 rounded-lg border p-2 text-left text-sm aria-[current=true]:border-primary aria-[current=true]:bg-primary/10 aria-[current=true]:ring-primary aria-[current=true]:ring-2"
      :class="layout === 'strip' ? 'w-36 flex-col justify-center text-center' : ''"
      @click="emit('edit', index)"
    >
      <img v-if="build.species" :src="spriteUrl(build.species)" alt="" :width="layout === 'strip' ? 48 : 32" :height="layout === 'strip' ? 48 : 32" />
      <span v-else class="border-muted-foreground/30 inline-block size-8 rounded-full border border-dashed" />
      <span class="min-w-0 truncate font-medium">{{ build.species ? (names.data.value?.species[build.species] ?? build.species) : `Pokémon ${index + 1}` }}</span>
    </button>
    <button
      v-if="builds.length < MAX_TEAM_SIZE"
      type="button"
      class="text-muted-foreground hover:bg-muted rounded-lg border border-dashed p-2 text-sm"
      :class="layout === 'strip' ? 'w-36' : ''"
      @click="emit('add')"
    >
      + Add
    </button>
    <Button type="button" variant="outline" size="sm" :class="layout === 'strip' ? 'ml-auto self-center' : 'mt-2'" @click="emit('done')">
      ← Back to the Team
    </Button>
  </nav>
</template>
