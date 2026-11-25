<script setup lang="ts">
import { type TypeId, typeName } from '@myvgc/core/schema'
import { TYPE_ICON_SIZE, typeIconUrl } from '@/lib/icons'

/**
 * A type's Type icon (ADR 32). Unlike a Sprite it carries information, so it has the type's
 * name as its accessible name and as a tooltip. With no type (not known yet), a faint dashed
 * square of the same size takes its place, so rows stay aligned. If the file fails to load, the
 * gap keeps the type's name for screen readers and as a tooltip.
 */
const props = withDefaults(
  defineProps<{
    /** The type's Showdown ID, such as `fire`; none while it isn't known. */
    type?: TypeId
    /** In CSS px. */
    size?: number
  }>(),
  { type: undefined, size: TYPE_ICON_SIZE },
)

const name = computed(() => (props.type ? typeName(props.type) : undefined))
const box = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }))

const failed = ref(false)
watch(
  () => props.type,
  () => (failed.value = false),
)
</script>

<template>
  <img
    v-if="props.type && !failed"
    :src="typeIconUrl(props.type)"
    :alt="name"
    :title="name"
    :width="props.size"
    :height="props.size"
    loading="lazy"
    decoding="async"
    class="shrink-0 rounded-[22%] object-contain"
    :style="box"
    data-testid="type-icon"
    @error="failed = true"
  />
  <span
    v-else-if="props.type"
    role="img"
    :aria-label="name"
    :title="name"
    class="border-muted-foreground/30 inline-block shrink-0 rounded-[22%] border border-dashed"
    :style="box"
    data-testid="type-icon-gap"
  />
  <span
    v-else
    aria-hidden="true"
    class="border-muted-foreground/30 inline-block shrink-0 rounded-[22%] border border-dashed"
    :style="box"
    data-testid="type-icon-gap"
  />
</template>
