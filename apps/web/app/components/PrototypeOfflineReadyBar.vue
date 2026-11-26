<script setup lang="ts">
// PROTOTYPE (DEV-246), throwaway: never merge to main. The floating bar that switches between the
// three notices, sets when they show, their progress and wording, and replays a slow download.
// ← and → also switch the variant. See usePrototypeOfflineReady.
import {
  PROGRESS_LABELS,
  VARIANT_LABELS,
  VARIANTS,
  WHEN_LABELS,
  type Progress,
  type When,
  type Wording,
  watchRealServiceWorker,
} from '@/composables/usePrototypeOfflineReady'

const notice = usePrototypeOfflineReady()
const { choices, set, phase, reason, done, total, shown, source } = notice
const route = useRoute()
const router = useRouter()
const open = ref(true)

function cycle(step: 1 | -1) {
  const index = VARIANTS.indexOf(choices.value.variant)
  set('variant', VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length]!)
}
function onKey(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return
  cycle(event.key === 'ArrowLeft' ? -1 : 1)
}

// ?variant= on any address sets the variant; the address then follows the bar.
const fromQuery = route.query.variant
if (fromQuery === 'A' || fromQuery === 'B' || fromQuery === 'C') set('variant', fromQuery)
watch(
  () => [choices.value.variant, route.path] as const,
  ([variant]) => {
    if (route.query.variant !== variant) void router.replace({ query: { ...route.query, variant } })
  },
)

onMounted(() => {
  window.addEventListener('keydown', onKey)
  watchRealServiceWorker()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const WHENS = Object.keys(WHEN_LABELS) as When[]
const PROGRESSES = Object.keys(PROGRESS_LABELS) as Progress[]
const WORDING_KEYS: Wording[] = [1, 2, 3]
const dev = import.meta.dev
const pill = (on: boolean) => (on ? 'bg-white font-semibold text-fuchsia-950' : 'hover:bg-white/15')
</script>

<template>
  <div v-if="dev" class="h-28" aria-hidden="true" />
  <div
    v-if="dev"
    class="fixed bottom-2 left-1/2 z-[60] flex w-[calc(100vw-1rem)] max-w-3xl -translate-x-1/2 flex-col gap-1.5 rounded-2xl bg-fuchsia-950 px-3 py-2 text-xs text-white shadow-xl ring-2 ring-fuchsia-400"
    data-testid="prototype-bar"
  >
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span class="font-semibold tracking-wide text-fuchsia-300 uppercase">Prototype DEV-246</span>
      <span class="flex items-center gap-1">
        <button type="button" class="rounded-full px-2 py-0.5 hover:bg-white/15" @click="cycle(-1)">
          ←
        </button>
        <span class="font-semibold"
          >{{ choices.variant }} · {{ VARIANT_LABELS[choices.variant] }}</span
        >
        <button type="button" class="rounded-full px-2 py-0.5 hover:bg-white/15" @click="cycle(1)">
          →
        </button>
      </span>
      <button
        type="button"
        class="rounded-full bg-fuchsia-400 px-2 py-0.5 font-semibold text-fuchsia-950"
        @click="notice.replay('first')"
      >
        Replay first visit
      </button>
      <button
        type="button"
        class="rounded-full bg-fuchsia-400 px-2 py-0.5 font-semibold text-fuchsia-950"
        @click="notice.replay('update')"
      >
        Replay update
      </button>
      <button
        type="button"
        class="ml-auto rounded-full px-2 py-0.5 text-fuchsia-300 hover:bg-white/15"
        @click="open = !open"
      >
        {{ open ? 'Less' : 'More' }}
      </button>
    </div>
    <template v-if="open">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span class="flex flex-wrap items-center gap-1">
          <span class="text-fuchsia-300">When:</span>
          <button
            v-for="value in WHENS"
            :key="value"
            type="button"
            class="rounded-full px-2 py-0.5"
            :class="pill(choices.when === value)"
            @click="set('when', value)"
          >
            {{ WHEN_LABELS[value] }}
          </button>
        </span>
        <span class="flex flex-wrap items-center gap-1">
          <span class="text-fuchsia-300">Progress:</span>
          <button
            v-for="value in PROGRESSES"
            :key="value"
            type="button"
            class="rounded-full px-2 py-0.5"
            :class="pill(choices.progress === value)"
            @click="set('progress', value)"
          >
            {{ PROGRESS_LABELS[value] }}
          </button>
        </span>
        <span class="flex flex-wrap items-center gap-1">
          <span class="text-fuchsia-300">Wording:</span>
          <button
            v-for="value in WORDING_KEYS"
            :key="value"
            type="button"
            class="rounded-full px-2 py-0.5"
            :class="pill(choices.wording === value)"
            @click="set('wording', value)"
          >
            {{ value }}
          </button>
        </span>
      </div>
      <p class="text-fuchsia-200" data-testid="prototype-state">
        State: {{ phase
        }}<template v-if="phase !== 'idle'">
          · {{ reason === 'first' ? 'first visit' : 'update' }} · {{ done }} of {{ total }} files ·
          from {{ source }} ·
          {{ shown ? 'notice shown' : 'notice hidden (When is First visit only)' }}</template
        >
        <template v-if="choices.variant === 'C'"> · open Settings to see it</template>
      </p>
    </template>
  </div>
</template>
