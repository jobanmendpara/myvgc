<script setup lang="ts">
import { DEFAULT_LIST_STYLES, type ListStyle, type ListStyles } from '@myvgc/core/schema'

// The list of Tournaments, Teams or Opponents, as ListDetail's `#list`: a header with the title,
// the List style control and the page's actions, then the rows in the list's List style, or
// the loading, error or empty state. On wide screens it is the list column: its width follows
// the List style, and the header stays put while the rows scroll.
const props = defineProps<{
  /** Which list, for its List style. */
  list: keyof ListStyles
  title: string
  wide: boolean
  /** Whether the list itself is still loading. */
  pending: boolean
  /** What to say if the list can't be loaded. */
  error?: string
  /** Whether the list loaded with nothing in it: the `#empty` slot shows instead. */
  empty: boolean
}>()
defineSlots<{
  /** Beside the title, such as the New button. */
  actions(): unknown
  /** Below the title, such as a search box. */
  header?(): unknown
  empty(): unknown
  default(props: { listStyle: ListStyle }): unknown
}>()

const { style, changeable, online, failed, setStyle } = useListStyle(props.list)
// On a device with nothing cached yet, wait for the List style too, so the wrong one never
// flashes up first.
const loading = computed(() => props.pending || !style.value)
const showControl = computed(() => !loading.value && !props.error && !props.empty)
const width = computed(() =>
  (style.value ?? DEFAULT_LIST_STYLES[props.list]) === 'detailed' ? 'w-[360px]' : 'w-[320px]',
)
</script>

<template>
  <div :class="wide ? ['flex min-h-0 flex-1 flex-col', width] : 'flex flex-col gap-6'">
    <div class="flex flex-col" :class="wide ? 'shrink-0 gap-3 border-b p-3' : 'gap-6'">
      <div class="flex flex-col gap-1">
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="mr-auto" :class="wide ? 'text-lg font-semibold' : 'text-2xl font-semibold'">
            {{ title }}
          </h1>
          <ListStyleControl
            v-if="showControl"
            :model-value="style"
            :name="`list-style-${list}`"
            :disabled="!changeable"
            @update:model-value="setStyle"
          />
          <slot name="actions" />
        </div>
        <p
          v-if="showControl && !online"
          class="text-muted-foreground text-xs"
          data-testid="list-style-offline"
        >
          Online only. Connect to change the List style.
        </p>
        <p v-else-if="showControl && failed" class="text-destructive text-xs" role="alert">
          Couldn't save the List style. Try again.
        </p>
      </div>
      <slot name="header" />
    </div>

    <div :class="{ 'min-h-0 flex-1 overflow-y-auto pb-16': wide }">
      <p v-if="loading" class="text-muted-foreground" :class="{ 'p-3 text-sm': wide }">Loading…</p>
      <div v-else-if="error" :class="{ 'p-2': wide }">
        <Alert variant="destructive" role="alert">
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>
      </div>
      <div v-else-if="empty" :class="{ 'p-2': wide }">
        <slot name="empty" />
      </div>
      <slot v-else :list-style="style!" />
    </div>
  </div>
</template>
