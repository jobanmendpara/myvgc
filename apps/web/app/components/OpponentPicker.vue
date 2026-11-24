<script setup lang="ts">
import type { OpponentView } from '@myvgc/core/schema'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { refDebounced } from '@vueuse/core'
import { opponentOptions, SUGGESTIONS, suggestOpponents } from '@/lib/opponent-suggestions'

/** Who the User played: one of their Opponents, or a new one to add on the spot. */
export type OpponentChoice =
  { kind: 'existing'; id: string; displayName: string } | { kind: 'new'; displayName: string }

const props = withDefaults(
  defineProps<{
    error?: string
    label?: string
    /** An Opponent to leave out of the suggestions, such as the one being merged into. */
    exclude?: string
    /** Whether typing a new name offers to add it as a new Opponent. */
    allowNew?: boolean
  }>(),
  { error: undefined, label: 'Opponent', exclude: undefined, allowNew: true },
)
const choice = defineModel<OpponentChoice | null>({ required: true })

const text = ref('')
const open = ref(false)
const active = ref(0)
const search = refDebounced(text, 200)
// One more when one is left out, so there are still enough to show.
const limit = computed(() => SUGGESTIONS + (props.exclude ? 1 : 0))
const queryClient = useQueryClient()
// The server searches; when it can't be reached, the Opponents list cached on the device does.
const matches = useQuery({
  queryKey: computed(() => ['opponents', 'suggestions', search.value.trim(), limit.value]),
  queryFn: () =>
    suggestOpponents(search.value, limit.value, () =>
      queryClient.getQueryData<OpponentView[]>(['opponents', 'list']),
    ),
  enabled: computed(() => open.value),
  placeholderData: (previous) => previous,
  // Runs with no signal too, so the cached list is searched; paused, it would suggest no one.
  networkMode: 'always',
})

const typed = computed(() => text.value.trim())
const options = computed(() =>
  opponentOptions(matches.data.value ?? [], typed.value, {
    exclude: props.exclude,
    allowNew: props.allowNew,
  }),
)
watch(options, () => (active.value = 0))

function pick(index: number) {
  const option = options.value[index]
  if (!option) return
  choice.value =
    option.kind === 'existing'
      ? { kind: 'existing', id: option.opponent.id, displayName: option.opponent.displayName }
      : { kind: 'new', displayName: typed.value }
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

/** Which Alias matched, to show why an Opponent came up. */
function matchedAlias(o: OpponentView) {
  const q = typed.value.toLowerCase()
  if (!q || o.displayName.toLowerCase().includes(q)) return undefined
  return o.aliases.find((a) => a.toLowerCase().includes(q))
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <Label for="opponent">{{ props.label }}</Label>
    <div
      v-if="choice"
      class="flex min-h-11 items-center justify-between gap-2 rounded-md border px-3"
      data-testid="opponent-choice"
    >
      <span class="min-w-0 break-words">
        {{ choice.displayName }}
        <span v-if="choice.kind === 'new'" class="text-muted-foreground text-xs">(new)</span>
      </span>
      <Button type="button" variant="ghost" size="sm" @click="choice = null">Change</Button>
    </div>
    <div v-else class="relative">
      <Input
        id="opponent"
        v-model="text"
        role="combobox"
        autocomplete="off"
        autocapitalize="words"
        placeholder="Name, screen name or nickname"
        :aria-expanded="open"
        aria-controls="opponent-options"
        aria-autocomplete="list"
        :aria-activedescendant="open && options.length ? `opponent-option-${active}` : undefined"
        :aria-invalid="props.error ? true : undefined"
        aria-describedby="opponent-error"
        @focus="open = true"
        @input="open = true"
        @keydown="onKeydown"
        @blur="open = false"
      />
      <ul
        v-if="open && options.length"
        id="opponent-options"
        role="listbox"
        class="bg-popover absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border p-1 shadow-md"
      >
        <li
          v-for="(option, index) in options"
          :id="`opponent-option-${index}`"
          :key="option.kind === 'existing' ? option.opponent.id : 'new'"
          role="option"
          :aria-selected="index === active"
          class="flex min-h-11 cursor-pointer flex-col justify-center rounded px-3 py-1 text-sm aria-selected:bg-muted"
          @mousedown.prevent="pick(index)"
          @mouseenter="active = index"
        >
          <template v-if="option.kind === 'existing'">
            <span>{{ option.opponent.displayName }}</span>
            <span v-if="matchedAlias(option.opponent)" class="text-muted-foreground text-xs"
              >also {{ matchedAlias(option.opponent) }}</span
            >
          </template>
          <span v-else class="font-medium">Add “{{ typed }}” as a new Opponent</span>
        </li>
      </ul>
    </div>
    <p v-if="props.error" id="opponent-error" class="text-destructive text-sm">{{ props.error }}</p>
  </div>
</template>
