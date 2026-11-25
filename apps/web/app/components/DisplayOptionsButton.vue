<script setup lang="ts">
import { SlidersHorizontalIcon } from '@lucide/vue'
import type { TypeId } from '@myvgc/core/schema'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import {
  BADGE_MOVE_TYPE_ICON_SIZE,
  BADGE_TYPE_ICON_SIZE,
  LABELLED_MOVE_TYPE_ICON_SIZE,
  LABELLED_TYPE_ICON_SIZE,
  MOVE_LAYOUT_LABELS,
  MOVE_LAYOUTS,
  MOVE_TYPE_ICON_SIZE,
  TYPE_ICON_STYLE_LABELS,
  TYPE_ICON_STYLES,
} from '@/lib/icons'
import { SPRITE_PAGES, SPRITE_STYLE_LABELS, SPRITE_STYLES } from '@/lib/sprites'

// The header's Display options button, on the four pages that show Sprites (DEV-180, DEV-226).
// It opens a dialog, a bottom sheet on a phone, where the User picks the page's Sprite style
// and, on the pages with Pokémon build cards, its Type icon style and Move layout: Device
// settings kept per page. Each choice is previewed with the same samples, applies at once and
// leaves the dialog open, so the User can make all three; Enter on a choice closes it.
const { page, style, setStyle } = useSpriteStyle()
const {
  page: buildCardPage,
  typeIconStyle,
  moveLayout,
  setTypeIconStyle,
  setMoveLayout,
} = useBuildCardDisplay()
const open = ref(false)
const title = computed(() => page.value && `Display options for ${SPRITE_PAGES[page.value]}`)

const SAMPLE = { species: 'incineroar', name: 'Incineroar', item: 'Sitrus Berry' }
// Basculegion, Water/Ghost, and its moves.
const SAMPLE_TYPES: TypeId[] = ['water', 'ghost']
const SAMPLE_MOVES: { name: string; type: TypeId; powerAccuracy: string }[] = [
  { name: 'Wave Crash', type: 'water', powerAccuracy: '120/100' },
  { name: 'Last Respects', type: 'ghost', powerAccuracy: '50/100' },
]
const CHOICE =
  'has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-ring/50 flex cursor-pointer gap-2 rounded-lg border p-3 has-[:focus-visible]:ring-3'
</script>

<template>
  <template v-if="page">
    <Button
      variant="ghost"
      size="icon"
      :aria-label="title"
      :title="title"
      data-testid="display-options-button"
      @click="open = true"
    >
      <SlidersHorizontalIcon aria-hidden="true" />
    </Button>
    <DialogRoot v-model:open="open">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-40 bg-black/50" />
        <DialogContent
          :aria-describedby="undefined"
          class="bg-background fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col gap-5 overflow-y-auto rounded-t-xl border-t p-4 outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[26rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border"
          data-testid="display-options-dialog"
        >
          <div class="flex items-center justify-between gap-3">
            <!-- The icon stands for the title; the words are for screen readers. -->
            <DialogTitle class="flex items-center gap-2">
              <SlidersHorizontalIcon class="size-5" aria-hidden="true" />
              <span class="sr-only">{{ title }}</span>
            </DialogTitle>
            <Button type="button" variant="ghost" size="sm" @click="open = false">Close</Button>
          </div>

          <fieldset class="flex flex-col gap-2">
            <legend class="mb-2 text-sm font-medium">Sprites</legend>
            <label v-for="value in SPRITE_STYLES" :key="value" :class="[CHOICE, 'flex-col']">
              <input
                type="radio"
                class="sr-only"
                name="sprite-style"
                :value="value"
                :checked="style === value"
                @change="setStyle(value)"
                @keydown.enter.prevent="open = false"
              />
              <span class="text-sm font-medium">{{ SPRITE_STYLE_LABELS[value] }}</span>
              <!-- The same sample in each style, laid out as an Opponent's Team shows it. A
                   Stacked tile is centred in the card, with the held item on a line of its own
                   so its name never splits (DEV-196). -->
              <span
                aria-hidden="true"
                class="flex gap-2 text-sm"
                :class="
                  value === 'stacked-tiles'
                    ? 'w-32 flex-col items-center self-center text-center'
                    : 'items-center'
                "
              >
                <Sprite
                  v-if="value !== 'inline'"
                  :species="SAMPLE.species"
                  surface="opponent-team"
                  :sprite-style="value"
                />
                <span class="flex items-center gap-1">
                  <Sprite
                    v-if="value === 'inline'"
                    :species="SAMPLE.species"
                    surface="opponent-team"
                    sprite-style="inline"
                  />
                  <span
                    >{{ SAMPLE.name }}
                    <span
                      class="text-muted-foreground"
                      :class="{ 'block whitespace-nowrap': value === 'stacked-tiles' }"
                      >@ {{ SAMPLE.item }}</span
                    ></span
                  >
                </span>
              </span>
            </label>
          </fieldset>

          <!-- Statistics has no Pokémon build cards, so only Sprites. -->
          <template v-if="buildCardPage">
            <fieldset class="flex flex-col gap-2">
              <legend class="mb-2 text-sm font-medium">Type icons</legend>
              <label
                v-for="value in TYPE_ICON_STYLES"
                :key="value"
                :class="[CHOICE, 'items-center justify-between']"
              >
                <input
                  type="radio"
                  class="sr-only"
                  name="type-icon-style"
                  :value="value"
                  :checked="typeIconStyle === value"
                  @change="setTypeIconStyle(value)"
                  @keydown.enter.prevent="open = false"
                />
                <span class="text-sm font-medium">{{ TYPE_ICON_STYLE_LABELS[value] }}</span>
                <!-- Basculegion's types and Wave Crash, as the build card shows them. -->
                <span aria-hidden="true" class="flex items-center gap-3">
                  <span v-if="value === 'compact'" class="flex gap-1">
                    <TypeIcon v-for="type in SAMPLE_TYPES" :key="type" :type="type" />
                  </span>
                  <span v-else-if="value === 'badges'" class="flex flex-col gap-1">
                    <TypeIcon
                      v-for="type in SAMPLE_TYPES"
                      :key="type"
                      :type="type"
                      :size="BADGE_TYPE_ICON_SIZE"
                    />
                  </span>
                  <span v-else class="flex min-w-0 flex-wrap justify-end gap-1">
                    <TypeIcon
                      v-for="type in SAMPLE_TYPES"
                      :key="type"
                      :type="type"
                      :size="LABELLED_TYPE_ICON_SIZE"
                      labelled
                    />
                  </span>
                  <span class="bg-muted flex w-32 items-stretch overflow-hidden rounded text-sm">
                    <span
                      v-if="value === 'badges'"
                      class="flex items-center bg-black/10 p-1 dark:bg-white/5"
                    >
                      <TypeIcon type="water" :size="BADGE_MOVE_TYPE_ICON_SIZE" />
                    </span>
                    <span class="flex items-center gap-1.5 px-2 py-1 whitespace-nowrap">
                      <TypeIcon
                        v-if="value !== 'badges'"
                        type="water"
                        :size="
                          value === 'labelled' ? LABELLED_MOVE_TYPE_ICON_SIZE : MOVE_TYPE_ICON_SIZE
                        "
                      />
                      Wave Crash
                    </span>
                  </span>
                </span>
              </label>
            </fieldset>

            <fieldset class="flex flex-col gap-2">
              <legend class="mb-2 text-sm font-medium">Moves</legend>
              <label v-for="value in MOVE_LAYOUTS" :key="value" :class="[CHOICE, 'flex-col']">
                <input
                  type="radio"
                  class="sr-only"
                  name="move-layout"
                  :value="value"
                  :checked="moveLayout === value"
                  @change="setMoveLayout(value)"
                  @keydown.enter.prevent="open = false"
                />
                <span class="flex flex-wrap gap-x-1 text-sm">
                  <span class="font-medium">{{ MOVE_LAYOUT_LABELS[value] }}</span>
                  <span class="text-muted-foreground">{{
                    value === 'one-column' ? 'with power and accuracy' : 'more compact'
                  }}</span>
                </span>
                <span
                  aria-hidden="true"
                  class="grid gap-1 text-sm"
                  :class="value === 'one-column' ? 'grid-cols-1' : 'grid-cols-2'"
                >
                  <span
                    v-for="move in SAMPLE_MOVES"
                    :key="move.name"
                    class="bg-muted flex min-w-0 items-center gap-1.5 rounded px-2 py-1 whitespace-nowrap"
                  >
                    <TypeIcon :type="move.type" :size="MOVE_TYPE_ICON_SIZE" />
                    <span class="min-w-0 flex-1 truncate">{{ move.name }}</span>
                    <span
                      v-if="value === 'one-column'"
                      class="text-muted-foreground text-xs tabular-nums"
                      >{{ move.powerAccuracy }}</span
                    >
                  </span>
                </span>
              </label>
            </fieldset>
          </template>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </template>
</template>
