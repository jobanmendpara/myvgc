<script setup lang="ts">
import type { NameKind, PokemonBuild } from '@myvgc/core/schema'

// An Opponent's Team (ADR 22), read-only: each build's species, held item, ability and moves,
// leaving out what wasn't recorded.
defineProps<{ pokemon: PokemonBuild[] }>()

const names = useChampionsNames()
const nameOf = (kind: NameKind, id: string) => names.data.value?.[kind][id] ?? id
const { style: spriteStyle } = useSpriteStyle()
</script>

<template>
  <!-- Stacked tiles sit three a row at every width, as on the other Stacked tiles surfaces
       (DEV-193); the other styles take one row each on a phone. -->
  <ul
    class="grid gap-2"
    :class="spriteStyle === 'stacked-tiles' ? 'grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3'"
    aria-label="Opponent's Team"
  >
    <li
      v-for="build in pokemon"
      :key="build.species"
      class="bg-muted/40 flex gap-2 rounded-md p-2 text-sm"
      :class="{
        'flex-col items-center text-center': spriteStyle === 'stacked-tiles',
        'items-center': spriteStyle === 'leading-slot' && !build.ability && !build.moves.length,
      }"
    >
      <!-- Inline: the Sprite before the name. Leading slot: a slot to the left. Stacked tiles:
           on top, centred. In Leading slot a lone name line is centred on the slot (DEV-194). -->
      <Sprite v-if="spriteStyle !== 'inline'" :species="build.species" surface="opponent-team" />
      <div class="flex min-w-0 flex-col gap-0.5">
        <p
          class="flex items-center gap-1 font-medium"
          :class="{ 'justify-center': spriteStyle === 'stacked-tiles' }"
        >
          <Sprite
            v-if="spriteStyle === 'inline'"
            :species="build.species"
            surface="opponent-team"
          />
          <span class="min-w-0 break-words"
            >{{ nameOf('species', build.species) }}
            <span v-if="build.item" class="text-muted-foreground font-normal"
              >@ {{ nameOf('items', build.item) }}</span
            ></span
          >
        </p>
        <p v-if="build.ability" class="text-muted-foreground text-xs">
          {{ nameOf('abilities', build.ability) }}
        </p>
        <p v-if="build.moves.length" class="text-xs">
          {{ build.moves.map((move) => nameOf('moves', move)).join(' · ') }}
        </p>
      </div>
    </li>
  </ul>
</template>
