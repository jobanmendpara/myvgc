<script setup lang="ts">
import {
  type LegalityProblem,
  type NameKind,
  searchAbilities,
  searchNames,
} from '@myvgc/core/schema'

/**
 * Picks one species, move, item or ability from the names list, which works with no signal
 * once the list is on the device. The model is the Showdown ID (ADR 14); the User sees names.
 * For abilities, `species` puts that species' own abilities first (see `searchAbilities`).
 */
const props = defineProps<{
  id: string
  label: string
  kind: NameKind
  species?: string | null
  placeholder?: string
  error?: string
  /** What's illegal about the choice. These never stop a save (ADR 18). */
  problems?: LegalityProblem[]
}>()
const choice = defineModel<string | null>({ required: true })

const SUGGESTIONS = 8
// Pickers show a 20 px Item icon or Type icon before each name, whatever the page's Type icon
// style (DEV-218).
const PICKER_ICON_SIZE = 20
const names = useChampionsNames()
// A move's type comes from the names list (DEV-222); none until it is known.
const moveType = (move: string) => names.data.value?.moveTypes[move]
const table = computed(() => names.data.value?.[props.kind])
// Never loaded on this device, and the request failed or is waiting for a connection.
const unavailable = computed(
  () => !table.value && (names.isError.value || names.fetchStatus.value === 'paused'),
)
const text = ref('')
const open = ref(false)
const active = ref(0)
const options = computed(() => {
  if (!names.data.value || !table.value) return []
  return props.kind === 'abilities'
    ? searchAbilities(names.data.value, props.species, text.value, SUGGESTIONS)
    : searchNames(table.value, text.value, SUGGESTIONS)
})
watch(options, () => (active.value = 0))

// PROTOTYPE (DEV-265): details in the picker, in the bar's variant.
//   A: a pane at the bottom of the list shows the highlighted option's details.
//   B: a card beside the list shows them (mouse); an ⓘ on each option expands them (phone).
//   C: each option shows its short description under its name.
const { variant: tipVariant, touch } = usePrototypeTooltips()
const pokedex = usePrototypePokedexData()
const detailKind = computed(() => (props.kind === 'species' ? undefined : props.kind))
const shortDesc = (id: string) =>
  detailKind.value ? pokedex.data.value?.[detailKind.value][id]?.shortDesc : undefined
const expandedOption = ref<string | null>(null)
const activeId = computed(() => options.value[active.value]?.id)
// B's card sits left of the list, outside the build editor's sheet, so it goes to <body>.
const listbox = useTemplateRef<HTMLElement>('listbox')
const sideCard = ref<{ top: number; right: number } | null>(null)
watch([open, activeId, listbox], () => {
  const rect = listbox.value?.getBoundingClientRect()
  sideCard.value = rect ? { top: rect.top, right: window.innerWidth - rect.left + 8 } : null
}, { flush: 'post' })

const chosenName = computed(() =>
  choice.value ? (table.value?.[choice.value] ?? choice.value) : undefined,
)
const errorId = computed(() => `${props.id}-error`)
const listId = computed(() => `${props.id}-options`)

function pick(index: number) {
  const option = options.value[index]
  if (!option) return
  choice.value = option.id
  open.value = false
  text.value = ''
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    open.value = true
    active.value = Math.min(active.value + 1, options.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    active.value = Math.max(active.value - 1, 0)
  } else if (event.key === 'Enter') {
    if (open.value && options.value.length) {
      event.preventDefault()
      pick(active.value)
    }
  } else if (event.key === 'Escape') {
    open.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-2" :data-testid="`${props.id}-field`">
    <Label :for="props.id">{{ props.label }}</Label>
    <div
      v-if="choice"
      class="flex min-h-11 items-center justify-between gap-2 rounded-md border px-3"
      :data-testid="`${props.id}-choice`"
    >
      <span class="flex min-w-0 items-center gap-2">
        <Sprite v-if="props.kind === 'species'" :species="choice" surface="species-picker-choice" />
        <ItemIcon v-else-if="props.kind === 'items'" :item="choice" :size="PICKER_ICON_SIZE" />
        <TypeIcon
          v-else-if="props.kind === 'moves'"
          :type="moveType(choice)"
          :size="PICKER_ICON_SIZE"
        />
        <span class="min-w-0 break-words">{{ chosenName }}</span>
      </span>
      <Button type="button" variant="ghost" size="sm" @click="choice = null">Change</Button>
    </div>
    <p v-else-if="unavailable" class="text-muted-foreground text-sm">
      Couldn't load the list of names. Connect to the internet once and it will be kept on this
      device.
    </p>
    <div v-else class="relative">
      <Input
        :id="props.id"
        v-model="text"
        role="combobox"
        autocomplete="off"
        :placeholder="table ? props.placeholder : 'Loading names…'"
        :disabled="!table"
        :aria-expanded="open"
        :aria-controls="listId"
        aria-autocomplete="list"
        :aria-activedescendant="open && options.length ? `${props.id}-option-${active}` : undefined"
        :aria-invalid="props.error ? true : undefined"
        :aria-describedby="errorId"
        @focus="open = true"
        @input="open = true"
        @keydown="onKeydown"
        @blur="open = false"
      />
      <Teleport to="body">
        <div
          v-if="open && options.length && detailKind && tipVariant === 'B' && !touch && activeId && sideCard"
          class="bg-popover text-popover-foreground fixed z-[70] w-72 rounded-lg border p-3 shadow-lg"
          :style="{ top: `${sideCard.top}px`, right: `${sideCard.right}px` }"
        >
          <PrototypeDetailContent :kind="detailKind" :id="activeId" full />
        </div>
      </Teleport>
      <ul
        v-if="open && options.length"
        ref="listbox"
        :id="listId"
        role="listbox"
        class="bg-popover absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border p-1 shadow-md"
      >
        <li
          v-for="(option, index) in options"
          :id="`${props.id}-option-${index}`"
          :key="option.id"
          role="option"
          :aria-selected="index === active"
          class="flex min-h-11 cursor-pointer items-center gap-2 rounded px-3 py-1 text-sm aria-selected:bg-muted"
          @mousedown.prevent="pick(index)"
          @mouseenter="active = index"
        >
          <Sprite
            v-if="props.kind === 'species'"
            :species="option.id"
            surface="species-picker-option"
          />
          <ItemIcon v-else-if="props.kind === 'items'" :item="option.id" :size="PICKER_ICON_SIZE" />
          <TypeIcon
            v-else-if="props.kind === 'moves'"
            :type="moveType(option.id)"
            :size="PICKER_ICON_SIZE"
          />
          <span class="flex min-w-0 flex-1 flex-col">
            <span>{{ option.name }}</span>
            <span
              v-if="
                (tipVariant === 'C' || (tipVariant === 'B' && touch && expandedOption === option.id)) &&
                shortDesc(option.id)
              "
              class="text-muted-foreground text-xs"
              :class="{ 'line-clamp-2': tipVariant === 'C' }"
              >{{ shortDesc(option.id) }}</span
            >
          </span>
          <button
            v-if="tipVariant === 'B' && touch && detailKind"
            type="button"
            class="text-muted-foreground -my-2 -mr-2 shrink-0 self-stretch px-3"
            aria-label="Details"
            @mousedown.prevent.stop
            @click.stop="expandedOption = expandedOption === option.id ? null : option.id"
          >
            ⓘ
          </button>
        </li>
        <li
          v-if="tipVariant === 'A' && detailKind && activeId"
          role="presentation"
          class="bg-popover sticky -bottom-1 -mx-1 -mb-1 border-t p-3"
        >
          <PrototypeDetailContent :kind="detailKind" :id="activeId" />
        </li>
      </ul>
    </div>
    <p v-if="props.error" :id="errorId" class="text-destructive text-sm">{{ props.error }}</p>
    <LegalityWarnings v-if="props.problems?.length" :problems="props.problems" />
  </div>
</template>
