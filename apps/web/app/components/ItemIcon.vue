<script setup lang="ts">
import { ITEM_ICON_SIZE, itemIconUrl } from '@/lib/icons'

/**
 * A held item's Item icon (ADR 32). It's decoration, so `alt=""`: the item's name always shows
 * beside it. Pixel art stays crisp. When there is no file, or it fails to load, an empty gap of
 * the same size takes its place, so names stay aligned.
 */
const props = withDefaults(
  defineProps<{
    /** The item's Showdown ID, as stored on the build, such as `choicescarf`. */
    item: string
    /** In CSS px. */
    size?: number
  }>(),
  { size: ITEM_ICON_SIZE },
)

const box = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }))

const failed = ref(false)
watch(
  () => props.item,
  () => (failed.value = false),
)
</script>

<template>
  <img
    v-if="!failed"
    :src="itemIconUrl(props.item)"
    alt=""
    :width="props.size"
    :height="props.size"
    loading="lazy"
    decoding="async"
    class="shrink-0 object-contain [image-rendering:pixelated]"
    :style="box"
    data-testid="item-icon"
    @error="failed = true"
  />
  <span
    v-else
    aria-hidden="true"
    class="inline-block shrink-0"
    :style="box"
    data-testid="item-icon-gap"
  />
</template>
