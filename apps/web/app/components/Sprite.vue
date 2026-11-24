<script setup lang="ts">
import { type SpriteStyle, type SpriteSurface, spriteSize, spriteUrl } from '@/lib/sprites'

/**
 * A species or form's Sprite (ADR 29), sized for the surface it's on in the page's Sprite style.
 * It's decoration, so `alt=""`: the name always shows beside it. When there is no file, or it
 * fails to load, a faint dashed circle of the same size takes its place, so rows stay aligned.
 * In the dark theme a thin light outline follows the Sprite's shape, so dark Sprites such as
 * Garchomp or Tauros-Paldea-Combat stand out from near-black backgrounds (DEV-200).
 */
const props = defineProps<{
  /** The Showdown ID stored on the build, such as `charizardmegax`. */
  species: string
  surface: SpriteSurface
  /** A Sprite style other than the page's, as in the Sprite style dialog's previews. */
  spriteStyle?: SpriteStyle
}>()

const { style } = useSpriteStyle()
const size = computed(() => spriteSize(props.surface, props.spriteStyle ?? style.value))
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
    class="shrink-0 object-contain dark:[filter:drop-shadow(0_0_0.5px_rgb(255_255_255/0.5))_drop-shadow(0_0_0.5px_rgb(255_255_255/0.5))]"
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
