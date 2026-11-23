<script setup lang="ts">
import { type SpriteSurface, spriteSize, spriteUrl } from '@/lib/sprites'

/**
 * A species or form's Sprite (ADR 29), sized for the surface it's on in the page's Sprite style.
 * It's decoration, so `alt=""`: the name always shows beside it. When there is no file, or it
 * fails to load, a faint dashed circle of the same size takes its place, so rows stay aligned.
 */
const props = defineProps<{
  /** The Showdown ID stored on the build, such as `charizardmegax`. */
  species: string
  surface: SpriteSurface
}>()

const style = useSpriteStyle()
const size = computed(() => spriteSize(props.surface, style.value))
const box = computed(() => ({ width: `${size.value}px`, height: `${size.value}px` }))

const failed = ref(false)
watch(
  () => props.species,
  () => (failed.value = false),
)
</script>

<template>
  <img
    v-if="!failed"
    :src="spriteUrl(props.species)"
    alt=""
    :width="size"
    :height="size"
    loading="lazy"
    decoding="async"
    class="shrink-0 object-contain"
    :style="box"
    data-testid="sprite"
    @error="failed = true"
  />
  <span
    v-else
    aria-hidden="true"
    class="border-muted-foreground/30 inline-block shrink-0 rounded-full border border-dashed"
    :style="box"
    data-testid="sprite-gap"
  />
</template>
