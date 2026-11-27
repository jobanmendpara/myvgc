<script setup lang="ts">
// PROTOTYPE (DEV-265), throwaway: never merge to main. Wraps a name (or a Pokémon's Type icons)
// with its detail tooltip, in the bar's variant:
//   A: a short card on hover; on a phone an ⓘ after the name opens it in a popover.
//   B: a full card on hover, and the name links to its Pokédex entry; on a phone an ⓘ opens
//      the full details in a bottom sheet.
//   C: the short card on hover; on a phone nothing here: the card's own ⓘ shows details inline.
import { InfoIcon } from '@lucide/vue'
import type { TypeId } from '@myvgc/core/schema'
import {
  HoverCardContent,
  HoverCardPortal,
  HoverCardRoot,
  HoverCardTrigger,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import { entryPath } from '@/composables/usePrototypePokedex'
import type { DetailKind } from '@/composables/usePrototypeTooltips'

const props = defineProps<{
  kind: DetailKind
  id?: string
  types?: TypeId[]
  label?: string
  /** Layout for what's wrapped, such as a column of Type icons. */
  triggerClass?: string
}>()
const { variant, touch } = usePrototypeTooltips()
const full = computed(() => variant.value === 'B')
const sheetOpen = ref(false)
const linkTo = computed(() =>
  variant.value === 'B' && props.id && props.kind !== 'types' ? entryPath(props.kind, props.id) : undefined,
)
const what = computed(() => props.label ?? (props.kind === 'types' ? 'Type matchups' : 'details'))
</script>

<template>
  <!-- A mouse: hover, or focus with the keyboard. -->
  <HoverCardRoot v-if="!touch" :open-delay="variant === 'B' ? 300 : 450" :close-delay="120">
    <HoverCardTrigger as-child>
      <NuxtLink
        v-if="linkTo"
        :to="linkTo"
        class="min-w-0 underline decoration-dotted decoration-1 underline-offset-2 hover:decoration-solid"
        ><slot
      /></NuxtLink>
      <span
        v-else
        tabindex="0"
        :class="triggerClass"
        class="min-w-0 cursor-help rounded-sm outline-none hover:underline hover:decoration-dotted focus-visible:ring-2 focus-visible:ring-ring/50"
        ><slot
      /></span>
    </HoverCardTrigger>
    <HoverCardPortal>
      <HoverCardContent
        side="top"
        :side-offset="6"
        align="start"
        class="bg-popover text-popover-foreground z-50 rounded-lg border p-3 shadow-lg"
        :class="full ? 'w-80' : 'w-64'"
      >
        <PrototypeDetailContent :kind="kind" :id="id" :types="types" :full="full" :link="variant !== 'B'" />
      </HoverCardContent>
    </HoverCardPortal>
  </HoverCardRoot>

  <!-- A phone. -->
  <span v-else class="inline-flex min-w-0 items-center gap-1">
    <span v-if="triggerClass" :class="triggerClass"><slot /></span>
    <slot v-else />
    <PopoverRoot v-if="variant === 'A'">
      <PopoverTrigger
        class="text-muted-foreground -m-1.5 shrink-0 p-1.5"
        :aria-label="`${what}`"
        @click.stop
      >
        <InfoIcon class="size-3.5" />
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          side="top"
          :side-offset="6"
          :collision-padding="12"
          class="bg-popover text-popover-foreground z-50 w-[min(18rem,calc(100vw-1.5rem))] rounded-lg border p-3 shadow-lg"
        >
          <PrototypeDetailContent :kind="kind" :id="id" :types="types" link />
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
    <template v-else-if="variant === 'B'">
      <button type="button" class="text-muted-foreground -m-1.5 shrink-0 p-1.5" :aria-label="what" @click.stop="sheetOpen = true">
        <InfoIcon class="size-3.5" />
      </button>
      <Sheet v-model:open="sheetOpen">
        <SheetContent side="bottom" class="max-h-[80dvh] overflow-y-auto rounded-t-2xl p-5">
          <SheetTitle class="sr-only">{{ what }}</SheetTitle>
          <PrototypeDetailContent :kind="kind" :id="id" :types="types" full link />
        </SheetContent>
      </Sheet>
    </template>
  </span>
</template>
