<script setup lang="ts">
// PROTOTYPE (DEV-218): a Type icon, or a gap of its size when the type isn't known.
import { TYPE_NAMES } from '@/composables/usePrototypeIcons'

const props = defineProps<{ type?: string; size: number; label?: boolean }>()
const name = computed(() => (props.type ? TYPE_NAMES[props.type] : undefined))
</script>

<template>
  <span
    v-if="props.type && props.label"
    class="bg-muted inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5 text-xs font-medium"
    :title="name"
  >
    <img :src="`/prototype-icons/types/${props.type}.png`" alt="" :width="props.size" :height="props.size" class="rounded-full" />
    {{ name }}
  </span>
  <img
    v-else-if="props.type"
    :src="`/prototype-icons/types/${props.type}.png`"
    :alt="name"
    :title="name"
    :width="props.size"
    :height="props.size"
    class="shrink-0 rounded-[22%]"
    :style="{ width: `${props.size}px`, height: `${props.size}px` }"
  />
  <span
    v-else
    aria-hidden="true"
    class="border-muted-foreground/30 inline-block shrink-0 rounded border border-dashed"
    :style="{ width: `${props.size}px`, height: `${props.size}px` }"
  />
</template>
