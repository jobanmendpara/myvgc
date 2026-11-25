<script setup lang="ts">
// PROTOTYPE (DEV-218): floating bar. ← → cycle the Type icon style (for a quick look, without
// changing the setting); the second button flips the move layout.
import {
  ICON_VARIANT_NAMES,
  ICON_VARIANTS,
  type IconVariant,
  MOVE_LAYOUT_NAMES,
} from '@/composables/usePrototypeIcons'

const route = useRoute()
const router = useRouter()
const { variant, moveLayout } = usePrototypeIcons()
function go(step: number) {
  const index = ICON_VARIANTS.indexOf(variant.value)
  const next = ICON_VARIANTS[
    (index + step + ICON_VARIANTS.length) % ICON_VARIANTS.length
  ] as IconVariant
  router.replace({ query: { ...route.query, variant: next } })
}
function flipMoves() {
  router.replace({ query: { ...route.query, moves: moveLayout.value === 'fit' ? 'list' : 'fit' } })
}
function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable]')) return
  if (event.key === 'ArrowLeft') go(-1)
  if (event.key === 'ArrowRight') go(1)
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') flipMoves()
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div
    class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-fuchsia-600 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-lg"
    data-prototype-switcher
  >
    <button type="button" aria-label="Previous Type icon style" @click="go(-1)">←</button>
    <span>{{ ICON_VARIANT_NAMES[variant] }}</span>
    <button type="button" aria-label="Next Type icon style" @click="go(1)">→</button>
    <span class="opacity-50">|</span>
    <button type="button" class="underline underline-offset-2" @click="flipMoves">
      Moves: {{ MOVE_LAYOUT_NAMES[moveLayout] }} ↕
    </button>
  </div>
</template>
