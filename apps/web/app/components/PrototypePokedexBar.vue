<script setup lang="ts">
// PROTOTYPE (DEV-264), throwaway: never merge to main. The floating bar: ← and → switch the
// variant; the toggles show the compact species entry and the links between entries.
import { VARIANT_LABELS, VARIANTS } from '@/composables/usePrototypePokedex'

const { variant, setVariant, compact, links } = usePrototypePokedexBar()
function step(by: number) {
  const at = VARIANTS.indexOf(variant.value)
  setVariant(VARIANTS[(at + by + VARIANTS.length) % VARIANTS.length]!)
}
function onKey(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable]')) return
  step(event.key === 'ArrowLeft' ? -1 : 1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
const dev = import.meta.dev
</script>

<template>
  <div
    v-if="dev"
    class="fixed bottom-4 left-1/2 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-2xl bg-fuchsia-950 px-4 py-2 text-xs text-white shadow-xl ring-2 ring-fuchsia-400"
    data-testid="prototype-bar"
  >
    <span class="font-semibold tracking-wide text-fuchsia-300 uppercase">Prototype DEV-264</span>
    <span class="flex items-center gap-1">
      <button type="button" class="rounded-full px-2 py-0.5 hover:bg-white/15" aria-label="Previous variant" @click="step(-1)">←</button>
      <span class="font-semibold">{{ variant }} · {{ VARIANT_LABELS[variant] }}</span>
      <button type="button" class="rounded-full px-2 py-0.5 hover:bg-white/15" aria-label="Next variant" @click="step(1)">→</button>
    </span>
    <label class="flex items-center gap-1"><input v-model="compact" type="checkbox" class="accent-fuchsia-400" /> Compact species entry</label>
    <label class="flex items-center gap-1"><input v-model="links" type="checkbox" class="accent-fuchsia-400" /> Learnsets and links</label>
  </div>
</template>
