<script setup lang="ts">
// The list and detail layout for an area such as Tournaments. The area's page is a parent
// route: it passes its list as `#list` and its child pages (`<NuxtPage />`) as the default slot.
// Give the parent page `definePageMeta({ listDetail: true })` so the layout fills the height.
//
// On wide screens the list sits in a column and the child page opens beside it, each scrolling
// on its own; at the area's own path the pane shows the placeholder. The list (a ListColumn)
// sets the column's width and scrolls its own rows. On phones the
// list is the area's full page and each child page is a full page of its own.
const props = defineProps<{
  /** The area's path, such as `/tournaments`. */
  base: string
  /** What the empty pane says, such as "Select a Tournament". */
  placeholder: string
}>()
defineSlots<{
  list(props: { wide: boolean }): unknown
  default(): unknown
}>()

const route = useRoute()
const wide = useWideLayout()
const atBase = computed(() => route.path.replace(/\/$/, '') === props.base)

// The window no longer scrolls on wide screens, so start each page at the top of the pane and
// bring the selected row into view, such as a Tournament just created.
const column = useTemplateRef('column')
const pane = useTemplateRef('pane')
watch(
  () => route.path,
  () => {
    pane.value?.scrollTo({ top: 0 })
    column.value?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' })
  },
  { flush: 'post' },
)
</script>

<template>
  <div v-if="wide" class="grid h-full grid-cols-[auto_1fr]">
    <aside ref="column" class="flex min-h-0 flex-col border-r">
      <slot name="list" :wide="true" />
    </aside>
    <div ref="pane" class="min-h-0 overflow-y-auto p-4 pb-16">
      <div
        v-if="atBase"
        class="text-muted-foreground flex h-full items-center justify-center"
        data-testid="list-detail-placeholder"
      >
        {{ placeholder }}
      </div>
      <slot v-else />
    </div>
  </div>
  <slot v-else-if="atBase" name="list" :wide="false" />
  <slot v-else />
</template>
