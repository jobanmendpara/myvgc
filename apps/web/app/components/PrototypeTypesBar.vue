<script setup lang="ts">
// PROTOTYPE (DEV-266), throwaway: never merge to main. ← and → switch the Types page variant.
import { TYPES_VARIANT_LABELS, TYPES_VARIANTS } from '@/composables/usePrototypeTypes'

const { variant, setVariant } = usePrototypeTypesVariant()
const route = useRoute()
function step(by: number) {
  const at = TYPES_VARIANTS.indexOf(variant.value)
  setVariant(TYPES_VARIANTS[(at + by + TYPES_VARIANTS.length) % TYPES_VARIANTS.length]!)
}
function onKey(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  if ((event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]')) return
  step(event.key === 'ArrowLeft' ? -1 : 1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
const dev = import.meta.dev
</script>

<template>
  <div
    v-if="dev"
    class="fixed bottom-4 left-1/2 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl bg-fuchsia-950 px-4 py-2 text-xs text-white shadow-xl ring-2 ring-fuchsia-400"
    data-testid="prototype-bar"
  >
    <span class="font-semibold tracking-wide text-fuchsia-300 uppercase">Prototype DEV-266</span>
    <span class="flex items-center gap-1">
      <button type="button" class="rounded-full px-2 py-0.5 hover:bg-white/15" aria-label="Previous variant" @click="step(-1)">←</button>
      <span class="font-semibold">{{ variant }} · {{ TYPES_VARIANT_LABELS[variant] }}</span>
      <button type="button" class="rounded-full px-2 py-0.5 hover:bg-white/15" aria-label="Next variant" @click="step(1)">→</button>
    </span>
    <NuxtLink v-if="!route.path.startsWith('/pokedex/types')" :to="{ path: '/pokedex/types', query: route.query }" class="text-fuchsia-300 underline">Go to Types</NuxtLink>
  </div>
</template>
