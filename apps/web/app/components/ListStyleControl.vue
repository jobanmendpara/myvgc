<script setup lang="ts">
import { LIST_STYLES, type ListStyle } from '@myvgc/core/schema'
import { LayoutListIcon, ListIcon, ListTreeIcon } from '@lucide/vue'

// The three-way List style control at the top of a list. Native radios, so the keyboard and
// screen readers work as usual; the names are hidden behind icons to fit the list column.
defineProps<{ name: string; disabled?: boolean }>()
const model = defineModel<ListStyle>()

const OPTIONS = {
  compact: { label: 'Compact', icon: ListIcon },
  detailed: { label: 'Detailed', icon: LayoutListIcon },
  grouped: { label: 'Grouped', icon: ListTreeIcon },
} satisfies Record<ListStyle, unknown>
</script>

<template>
  <div
    role="radiogroup"
    aria-label="List style"
    class="border-input bg-muted inline-flex h-8 shrink-0 items-center rounded-md border p-0.5"
    :class="{ 'opacity-60': disabled }"
  >
    <label
      v-for="value in LIST_STYLES"
      :key="value"
      :title="OPTIONS[value].label"
      class="text-muted-foreground has-[:checked]:bg-background has-[:checked]:text-foreground has-[:focus-visible]:ring-ring/50 inline-flex h-full cursor-pointer items-center rounded-sm px-2 has-[:checked]:shadow-xs has-[:disabled]:cursor-not-allowed has-[:focus-visible]:ring-3"
    >
      <input
        v-model="model"
        type="radio"
        class="sr-only"
        :name="name"
        :value="value"
        :disabled="disabled"
      />
      <component :is="OPTIONS[value].icon" class="size-4" aria-hidden="true" />
      <span class="sr-only">{{ OPTIONS[value].label }}</span>
    </label>
  </div>
</template>
