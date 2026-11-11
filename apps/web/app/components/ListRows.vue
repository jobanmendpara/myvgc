<script setup lang="ts" generic="T extends { id: string }">
import type { ListGroup, ListStyle } from '@myvgc/core/schema'
import { LIST_STYLE_LOOKS } from '@/lib/list-style-look'

// The rows of a list in its List style, each a link to the item. The List style picks the
// row's slot (`compact`, `detailed` or `grouped`) and its look (see LIST_STYLE_LOOKS), so the
// row components only say what a row shows in each style. The row of the item open beside the
// list is marked as selected.
const props = defineProps<{
  items: T[]
  listStyle: ListStyle
  wide: boolean
  /** The area's path, such as `/teams`; each row links to the item's page under it. */
  base: string
  /** How the Grouped List style groups the items. */
  groupBy: (items: T[]) => ListGroup<T>[]
  /** Whether the items are search results, which show under no headings. */
  searching: boolean
}>()
defineSlots<{
  compact(props: { item: T }): unknown
  detailed(props: { item: T }): unknown
  grouped(props: { item: T }): unknown
}>()

const look = computed(() => LIST_STYLE_LOOKS[props.listStyle])

// Without headings the items are one group with no label.
const groups = computed(() =>
  look.value.headings && !props.searching
    ? props.groupBy(props.items)
    : [{ label: '', items: props.items }],
)

// The item open beside the list, also while editing it or one of its parts.
const route = useRoute()
const selectedId = computed(() => ('id' in route.params ? String(route.params.id) : ''))
</script>

<template>
  <div :class="look.frame(wide)">
    <section v-for="group in groups" :key="group.label">
      <h2
        v-if="group.label"
        class="bg-muted text-muted-foreground sticky top-0 z-[1] px-3 py-1 text-xs font-semibold tracking-wide uppercase"
      >
        {{ group.label }}
      </h2>
      <ul :class="look.list(wide)">
        <li v-for="item in group.items" :key="item.id">
          <NuxtLink
            :to="`${base}/${item.id}`"
            :aria-current="item.id === selectedId ? 'page' : undefined"
            :class="look.link(wide)"
          >
            <slot v-if="listStyle === 'compact'" name="compact" :item="item" />
            <slot v-else-if="listStyle === 'detailed'" name="detailed" :item="item" />
            <slot v-else name="grouped" :item="item" />
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>
