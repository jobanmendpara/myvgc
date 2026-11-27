<script setup lang="ts">
// PROTOTYPE (DEV-267), throwaway: never merge to main. ← and → switch the editor variant.
import { EDITOR_VARIANT_LABELS, EDITOR_VARIANTS } from '@/composables/usePrototypeEditor'

const { variant, setVariant } = usePrototypeEditor()
function step(by: number) {
  const at = EDITOR_VARIANTS.indexOf(variant.value)
  setVariant(EDITOR_VARIANTS[(at + by + EDITOR_VARIANTS.length) % EDITOR_VARIANTS.length]!)
}
function onKey(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  if ((event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable], [role="listbox"]')) return
  step(event.key === 'ArrowLeft' ? -1 : 1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
const dev = import.meta.dev
const width = ref(0)
const measure = () => (width.value = window.innerWidth)
onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => window.removeEventListener('resize', measure))
</script>

<template>
  <div
    v-if="dev"
    class="fixed bottom-4 left-1/2 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl bg-fuchsia-950 px-4 py-2 text-xs text-white shadow-xl ring-2 ring-fuchsia-400"
    data-testid="prototype-bar"
  >
    <span class="font-semibold tracking-wide text-fuchsia-300 uppercase">Prototype DEV-267</span>
    <span class="flex items-center gap-1">
      <button type="button" class="rounded-full px-2 py-0.5 hover:bg-white/15" aria-label="Previous variant" @click="step(-1)">←</button>
      <span class="font-semibold">{{ variant }} · {{ EDITOR_VARIANT_LABELS[variant] }}</span>
      <button type="button" class="rounded-full px-2 py-0.5 hover:bg-white/15" aria-label="Next variant" @click="step(1)">→</button>
    </span>
    <span class="text-fuchsia-300">{{ width }} px: {{ width >= 1280 ? 'three columns' : width >= 1024 ? 'two columns, entry folds into the editor' : 'phone sheet, as today' }}</span>
  </div>
</template>
