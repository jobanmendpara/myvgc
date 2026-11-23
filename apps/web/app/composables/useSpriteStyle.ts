import type { SpriteStyle } from '@/lib/sprites'

// The Sprite style of the page on screen. Every page shows Inline for now; once the User can
// pick a style per page, this is the one place that looks it up, and each surface reads it to
// lay its Sprites out.
export function useSpriteStyle() {
  return computed<SpriteStyle>(() => 'inline')
}
