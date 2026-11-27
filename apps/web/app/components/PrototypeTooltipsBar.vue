<script setup lang="ts">
// PROTOTYPE (DEV-265), throwaway: never merge to main. The floating bar: ← and → switch the
// variant; "Act as" tries a phone's way on desktop.
import { TOOLTIP_VARIANT_LABELS, TOOLTIP_VARIANTS } from '@/composables/usePrototypeTooltips'

const { variant, setVariant, input, touch } = usePrototypeTooltips()
function step(by: number) {
  const at = TOOLTIP_VARIANTS.indexOf(variant.value)
  setVariant(TOOLTIP_VARIANTS[(at + by + TOOLTIP_VARIANTS.length) % TOOLTIP_VARIANTS.length]!)
}
function onKey(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable], [role="listbox"]')) return
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
    <span class="font-semibold tracking-wide text-fuchsia-300 uppercase">Prototype DEV-265</span>
    <span class="flex items-center gap-1">
      <button type="button" class="rounded-full px-2 py-0.5 hover:bg-white/15" aria-label="Previous variant" @click="step(-1)">←</button>
      <span class="font-semibold">{{ variant }} · {{ TOOLTIP_VARIANT_LABELS[variant] }}</span>
      <button type="button" class="rounded-full px-2 py-0.5 hover:bg-white/15" aria-label="Next variant" @click="step(1)">→</button>
    </span>
    <span class="flex items-center gap-1">
      <span class="text-fuchsia-300">Act as:</span>
      <button
        v-for="value in ['auto', 'mouse', 'touch'] as const"
        :key="value"
        type="button"
        class="rounded-full px-2 py-0.5"
        :class="input === value ? 'bg-white font-semibold text-fuchsia-950' : 'hover:bg-white/15'"
        @click="input = value"
      >
        {{ value === 'auto' ? `This device (${touch ? 'touch' : 'mouse'})` : value === 'mouse' ? 'Mouse' : 'Phone' }}
      </button>
    </span>
  </div>
</template>
