<script setup lang="ts">
// PROTOTYPE (DEV-218): floating bar to flip between icon variants. ← → keys too.
import { ICON_VARIANT_NAMES, ICON_VARIANTS, type IconVariant } from '@/composables/usePrototypeIcons'

const route = useRoute()
const router = useRouter()
const { variant } = usePrototypeIcons()
function go(step: number) {
  const index = ICON_VARIANTS.indexOf(variant.value)
  const next = ICON_VARIANTS[(index + step + ICON_VARIANTS.length) % ICON_VARIANTS.length] as IconVariant
  router.replace({ query: { ...route.query, variant: next } })
}
function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable]')) return
  if (event.key === 'ArrowLeft') go(-1)
  if (event.key === 'ArrowRight') go(1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div
    class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-fuchsia-600 px-3 py-1.5 text-sm font-medium text-white shadow-lg"
    data-prototype-switcher
  >
    <button type="button" aria-label="Previous variant" @click="go(-1)">←</button>
    <span>{{ variant }} ({{ ICON_VARIANT_NAMES[variant] }})</span>
    <button type="button" aria-label="Next variant" @click="go(1)">→</button>
  </div>
</template>
