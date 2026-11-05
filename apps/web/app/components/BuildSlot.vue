<script setup lang="ts">
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EllipsisVerticalIcon,
  GripVerticalIcon,
  XIcon,
} from '@lucide/vue'
import { useMediaQuery } from '@vueuse/core'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import type { BuildDraft } from '@/lib/team-form'

/**
 * One filled slot of the Team builder. With a mouse or trackpad it's reordered by dragging, with
 * a menu for keyboards and screen readers; on a phone it has its own buttons.
 */
const props = defineProps<{
  build: BuildDraft
  index: number
  count: number
  error?: string
}>()
const emit = defineEmits<{ edit: []; remove: []; move: [to: number] }>()

const finePointer = useMediaQuery('(pointer: fine)')
const names = useChampionsNames()
const nameOf = (kind: 'species' | 'items', id: string) => names.data.value?.[kind][id] ?? id

const title = computed(() => {
  if (!props.build.species) return 'No species yet'
  const species = nameOf('species', props.build.species)
  return props.build.nickname ? `${props.build.nickname} (${species})` : species
})
const moveCount = computed(() => props.build.moves.filter(Boolean).length)

const MENU_ITEM =
  'data-[highlighted]:bg-muted data-[disabled]:text-muted-foreground flex min-h-9 cursor-pointer items-center gap-2 rounded px-2 text-sm outline-none data-[disabled]:cursor-default [&_svg]:size-4'
</script>

<template>
  <li
    class="flex items-center gap-1 rounded-lg border p-2"
    :class="props.error ? 'border-destructive/50' : ''"
    data-testid="build-slot"
  >
    <GripVerticalIcon
      v-if="finePointer"
      class="text-muted-foreground size-4 shrink-0 cursor-grab"
      aria-hidden="true"
    />
    <button
      type="button"
      class="focus-visible:ring-ring/50 flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded px-2 text-left outline-none focus-visible:ring-3"
      @click="emit('edit')"
    >
      <span class="font-medium break-words">{{ title }}</span>
      <span v-if="props.build.species" class="text-muted-foreground text-sm">
        <template v-if="props.build.item">{{ nameOf('items', props.build.item) }} · </template>
        {{ moveCount === 1 ? '1 move' : `${moveCount} moves` }}
      </span>
      <span v-if="props.error" class="text-destructive text-sm">{{ props.error }}</span>
    </button>

    <DropdownMenuRoot v-if="finePointer">
      <DropdownMenuTrigger as-child>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          :aria-label="`Options for Pokémon ${props.index + 1}`"
        >
          <EllipsisVerticalIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          align="end"
          :side-offset="4"
          class="bg-popover z-30 min-w-36 rounded-md border p-1 shadow-md"
        >
          <DropdownMenuItem
            :class="MENU_ITEM"
            :disabled="props.index === 0"
            @select="emit('move', props.index - 1)"
          >
            <ArrowUpIcon aria-hidden="true" /> Move up
          </DropdownMenuItem>
          <DropdownMenuItem
            :class="MENU_ITEM"
            :disabled="props.index === props.count - 1"
            @select="emit('move', props.index + 1)"
          >
            <ArrowDownIcon aria-hidden="true" /> Move down
          </DropdownMenuItem>
          <DropdownMenuItem :class="MENU_ITEM" @select="emit('remove')">
            <XIcon aria-hidden="true" /> Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>

    <template v-else>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="size-11"
        :aria-label="`Move Pokémon ${props.index + 1} up`"
        :disabled="props.index === 0"
        @click="emit('move', props.index - 1)"
      >
        <ArrowUpIcon aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="size-11"
        :aria-label="`Move Pokémon ${props.index + 1} down`"
        :disabled="props.index === props.count - 1"
        @click="emit('move', props.index + 1)"
      >
        <ArrowDownIcon aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="size-11"
        :aria-label="`Remove Pokémon ${props.index + 1}`"
        @click="emit('remove')"
      >
        <XIcon aria-hidden="true" />
      </Button>
    </template>
  </li>
</template>
