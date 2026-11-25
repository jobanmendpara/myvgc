<script setup lang="ts">
// PROTOTYPE (DEV-218): an Item icon. Decoration, so alt="". Pixel art stays crisp.
const props = defineProps<{ item: string; size: number }>()
const failed = ref(false)
</script>

<template>
  <img
    v-if="!failed"
    :src="`/prototype-icons/items/${props.item}.png`"
    alt=""
    :width="props.size"
    :height="props.size"
    class="shrink-0 object-contain [image-rendering:pixelated]"
    :style="{ width: `${props.size}px`, height: `${props.size}px` }"
    @error="failed = true"
  />
  <span
    v-else
    aria-hidden="true"
    class="inline-block shrink-0"
    :style="{ width: `${props.size}px`, height: `${props.size}px` }"
  />
</template>
