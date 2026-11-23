import {
  type SpriteStyle,
  type SpriteStyles,
  parseSpriteStyles,
  spritePageOf,
  spriteStyleOf,
  SPRITE_STYLES_KEY,
} from '@/lib/sprites'
import { readStored, writeStored } from '@/lib/storage'

/**
 * The Sprite style of the page on screen, a Device setting kept per page (DEV-180), and the way
 * to change it. Shared by every Sprite on the page, so a change relays them all out at once. On a
 * page that shows no Sprites, `page` is undefined and the style is Inline.
 */
export function useSpriteStyle() {
  const route = useRoute()
  const styles = useState<SpriteStyles>('sprite-styles', () =>
    parseSpriteStyles(readStored(SPRITE_STYLES_KEY)),
  )
  const page = computed(() => spritePageOf(route.path))
  const style = computed(() => spriteStyleOf(styles.value, page.value))

  function setStyle(value: SpriteStyle) {
    if (!page.value) return
    styles.value = { ...styles.value, [page.value]: value }
    writeStored(SPRITE_STYLES_KEY, JSON.stringify(styles.value))
  }

  return { page, style, setStyle }
}
