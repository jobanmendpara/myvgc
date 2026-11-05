<script setup lang="ts">
import { type NameKind, searchAbilities, searchNames } from '@myvgc/core/schema'

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
}>()
const choice = defineModel<string | null>({ required: true })

const SUGGESTIONS = 8
const names = useChampionsNames()
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
  <div class="flex flex-col gap-2">
    <Label :for="props.id">{{ props.label }}</Label>
    <div
      v-if="choice"
      class="flex min-h-11 items-center justify-between gap-2 rounded-md border px-3"
      :data-testid="`${props.id}-choice`"
    >
      <span class="min-w-0 break-words">{{ chosenName }}</span>
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
      <ul
        v-if="open && options.length"
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
          class="flex min-h-11 cursor-pointer items-center rounded px-3 py-1 text-sm aria-selected:bg-muted"
          @mousedown.prevent="pick(index)"
          @mouseenter="active = index"
        >
          {{ option.name }}
        </li>
      </ul>
    </div>
    <p v-if="props.error" :id="errorId" class="text-destructive text-sm">{{ props.error }}</p>
  </div>
</template>
