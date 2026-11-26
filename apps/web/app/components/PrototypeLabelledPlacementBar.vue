<script setup lang="ts">
// PROTOTYPE (DEV-233), throwaway: never merge to main. The floating bar that switches every
// card between placement A and B, and sets the page's Sprite style, Type icon style and long
// item names. ← and → also switch the placement.
import { SPRITE_STYLE_LABELS, SPRITE_STYLES } from '@/lib/sprites'
import { PLACEMENT_LABELS, type Placement } from '@/composables/usePrototypeLabelledPlacement'

const { placement, overrides, longItems, setPlacement, setLongItems } =
  usePrototypeLabelledPlacement()
const { style: spriteStyle, setStyle } = useSpriteStyle()
const { typeIconStyle, setTypeIconStyle } = useBuildCardDisplay()
const flipped = computed(() => Object.keys(overrides.value).length)

function cycle() {
  setPlacement(placement.value === 'A' ? 'B' : 'A')
}

function onKey(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable]')) return
  cycle()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const PLACEMENTS: Placement[] = ['A', 'B']
const dev = import.meta.dev
</script>

<template>
  <div v-if="dev" class="h-24" aria-hidden="true" />
  <div
    v-if="dev"
    class="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-2xl bg-fuchsia-950 px-4 py-2 text-xs text-white shadow-xl ring-2 ring-fuchsia-400"
    data-testid="prototype-bar"
  >
    <span class="font-semibold tracking-wide text-fuchsia-300 uppercase">Prototype DEV-233</span>
    <span class="flex items-center gap-1">
      <span class="text-fuchsia-300">Pills:</span>
      <button
        v-for="key in PLACEMENTS"
        :key="key"
        type="button"
        class="rounded-full px-2 py-0.5"
        :class="placement === key ? 'bg-white font-semibold text-fuchsia-950' : 'hover:bg-white/15'"
        @click="setPlacement(key)"
      >
        {{ key }} · {{ PLACEMENT_LABELS[key] }}
      </button>
      <span v-if="flipped" class="text-fuchsia-300"
        >({{ flipped }} card{{ flipped === 1 ? '' : 's' }} flipped)</span
      >
    </span>
    <span class="flex items-center gap-1">
      <span class="text-fuchsia-300">Sprite:</span>
      <button
        v-for="value in SPRITE_STYLES"
        :key="value"
        type="button"
        class="rounded-full px-2 py-0.5"
        :class="
          spriteStyle === value ? 'bg-white font-semibold text-fuchsia-950' : 'hover:bg-white/15'
        "
        @click="setStyle(value)"
      >
        {{ SPRITE_STYLE_LABELS[value] }}
      </button>
    </span>
    <button
      v-if="typeIconStyle !== 'labelled'"
      type="button"
      class="rounded-full bg-amber-300 px-2 py-0.5 font-semibold text-amber-950"
      @click="setTypeIconStyle('labelled')"
    >
      Type icons are {{ typeIconStyle }}: switch to Labelled
    </button>
    <label class="flex items-center gap-1">
      <input
        type="checkbox"
        :checked="longItems"
        class="accent-fuchsia-400"
        @change="setLongItems(($event.target as HTMLInputElement).checked)"
      />
      Long item names (on screen only)
    </label>
  </div>
</template>
