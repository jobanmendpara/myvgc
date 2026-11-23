<script setup lang="ts">
import { ImageIcon } from '@lucide/vue'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { SPRITE_PAGES, SPRITE_STYLE_LABELS, SPRITE_STYLES, type SpriteStyle } from '@/lib/sprites'

// The header's Sprite style button, on the four pages that show Sprites (DEV-180). It opens a
// dialog, a bottom sheet on a phone, where the User picks the page's Sprite style, a Device
// setting. Each style is previewed with the same sample Pokémon.
const { page, style, setStyle } = useSpriteStyle()
const open = ref(false)
const SAMPLE = { species: 'incineroar', name: 'Incineroar', item: 'Sitrus Berry' }

// A choice applies at once. A click or tap (whose `detail` counts it, unlike the click a
// browser fires for arrow keys) or Enter also closes the dialog; arrow keys only move between
// styles, so a keyboard User can look through them first. A tap applies the style here rather
// than waiting for the radio's change: closing removes the radio before the label passes the
// click on to it.
function tap(value: SpriteStyle, event: MouseEvent) {
  if (event.detail === 0) return
  setStyle(value)
  open.value = false
}
</script>

<template>
  <template v-if="page">
    <Button
      variant="ghost"
      size="icon"
      aria-label="Sprite style"
      :title="`Sprite style: ${SPRITE_STYLE_LABELS[style]}`"
      data-testid="sprite-style-button"
      @click="open = true"
    >
      <ImageIcon aria-hidden="true" />
    </Button>
    <DialogRoot v-model:open="open">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-40 bg-black/50" />
        <DialogContent
          :aria-describedby="undefined"
          class="bg-background fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col gap-4 overflow-y-auto rounded-t-xl border-t p-4 outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[26rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border"
          data-testid="sprite-style-dialog"
        >
          <div class="flex items-center justify-between gap-3">
            <DialogTitle class="text-lg font-semibold"
              >Sprites on {{ SPRITE_PAGES[page] }}</DialogTitle
            >
            <Button type="button" variant="ghost" size="sm" @click="open = false">Close</Button>
          </div>
          <fieldset class="flex flex-col gap-2">
            <legend class="sr-only">Sprite style</legend>
            <label
              v-for="value in SPRITE_STYLES"
              :key="value"
              class="has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-ring/50 flex cursor-pointer flex-col gap-2 rounded-lg border p-3 has-[:focus-visible]:ring-3"
              @click="tap(value, $event)"
            >
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
              <!-- The same sample in each style, laid out as an Opponent's Team shows it. -->
              <span
                aria-hidden="true"
                class="flex gap-2 text-sm"
                :class="
                  value === 'stacked-tiles'
                    ? 'w-32 flex-col items-center text-center'
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
                    <span class="text-muted-foreground">@ {{ SAMPLE.item }}</span></span
                  >
                </span>
              </span>
            </label>
          </fieldset>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </template>
</template>
