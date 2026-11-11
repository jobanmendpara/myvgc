<script setup lang="ts" generic="T extends { id: string }">
import type { ListGroup, ListStyle } from '@myvgc/core/schema'

// The rows of a list in its List style, each a link to the item. The slot fills in what a row
// shows. Each List style marks the selected row its own way: an accent bar (Compact), a raised
// card with a primary ring (Detailed) or a primary tint (Grouped).
const props = defineProps<{
  items: T[]
  listStyle: ListStyle
  wide: boolean
  /** The id of the item open beside the list, if any. */
  selectedId: string
  /** The area's path, such as `/teams`; each row links to the item's page under it. */
  base: string
  /** How the Grouped List style groups the items; without it they show under no headings. */
  groupBy?: (items: T[]) => ListGroup<T>[]
}>()
defineSlots<{ default(props: { item: T }): unknown }>()

const groups = computed(() =>
  props.groupBy ? props.groupBy(props.items) : [{ label: '', items: props.items }],
)

const listClass = computed(() => {
  if (props.listStyle === 'detailed')
    return props.wide ? 'flex flex-col gap-1 p-2' : 'grid grid-cols-1 gap-3 md:grid-cols-2'
  return props.wide
    ? 'flex flex-col py-1'
    : 'flex flex-col divide-y overflow-hidden rounded-lg border'
})

const focus = 'outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
const linkClass = computed(() => {
  switch (props.listStyle) {
    case 'compact':
      return [
        focus,
        'hover:bg-muted/50 flex items-center justify-between gap-3 border-l-4 border-transparent px-3 text-sm focus-visible:ring-inset',
        'aria-[current=page]:border-primary aria-[current=page]:bg-muted aria-[current=page]:font-medium',
        props.wide ? 'py-2' : 'py-3',
      ]
    case 'detailed':
      return [
        focus,
        'hover:bg-muted/50 flex flex-col rounded-lg border',
        'aria-[current=page]:border-primary aria-[current=page]:bg-card aria-[current=page]:ring-primary aria-[current=page]:shadow-sm aria-[current=page]:ring-1',
        props.wide ? 'gap-1.5 border-transparent p-3 text-sm' : 'h-full gap-2 p-4',
      ]
    case 'grouped':
      return [
        focus,
        'hover:bg-muted/50 flex flex-col gap-0.5 px-3 text-sm focus-visible:ring-inset',
        'aria-[current=page]:bg-primary/10',
        props.wide ? 'py-2' : 'py-2.5',
      ]
  }
})
</script>

<template>
  <ul v-if="listStyle !== 'grouped'" :class="listClass">
    <li v-for="item in items" :key="item.id">
      <NuxtLink
        :to="`${base}/${item.id}`"
        :aria-current="item.id === selectedId ? 'page' : undefined"
        :class="linkClass"
      >
        <slot :item="item" />
      </NuxtLink>
    </li>
  </ul>

  <div v-else :class="{ 'overflow-clip rounded-lg border': !wide }">
    <section v-for="group in groups" :key="group.label">
      <h2
        v-if="group.label"
        class="bg-muted text-muted-foreground sticky top-0 z-[1] px-3 py-1 text-xs font-semibold tracking-wide uppercase"
      >
        {{ group.label }}
      </h2>
      <ul class="divide-y">
        <li v-for="item in group.items" :key="item.id">
          <NuxtLink
            :to="`${base}/${item.id}`"
            :aria-current="item.id === selectedId ? 'page' : undefined"
            :class="linkClass"
          >
            <slot :item="item" />
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>
