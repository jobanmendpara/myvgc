import {
  buildCardPageOf,
  type MoveLayout,
  type MoveLayouts,
  moveLayoutOf,
  MOVE_LAYOUTS_KEY,
  parseMoveLayouts,
  parseTypeIconStyles,
  type TypeIconStyle,
  type TypeIconStyles,
  typeIconStyleOf,
  TYPE_ICON_STYLES_KEY,
} from '@/lib/icons'
import { readStored, writeStored } from '@/lib/storage'

/**
 * How the page's Pokémon build cards show Type icons and list moves, Device settings kept per
 * page (DEV-226), and the way to change them. Shared by every card on the page, so a change
 * applies to them all at once. On a page without build cards, `page` is undefined and cards show
 * Compact and One column.
 */
export function useBuildCardDisplay() {
  const route = useRoute()
  const typeIconStyles = useState<TypeIconStyles>('type-icon-styles', () =>
    parseTypeIconStyles(readStored(TYPE_ICON_STYLES_KEY)),
  )
  const moveLayouts = useState<MoveLayouts>('move-layouts', () =>
    parseMoveLayouts(readStored(MOVE_LAYOUTS_KEY)),
  )
  const page = computed(() => buildCardPageOf(route.path))
  const typeIconStyle = computed(() => typeIconStyleOf(typeIconStyles.value, page.value))
  const moveLayout = computed(() => moveLayoutOf(moveLayouts.value, page.value))

  function setTypeIconStyle(value: TypeIconStyle) {
    if (!page.value) return
    typeIconStyles.value = { ...typeIconStyles.value, [page.value]: value }
    writeStored(TYPE_ICON_STYLES_KEY, JSON.stringify(typeIconStyles.value))
  }

  function setMoveLayout(value: MoveLayout) {
    if (!page.value) return
    moveLayouts.value = { ...moveLayouts.value, [page.value]: value }
    writeStored(MOVE_LAYOUTS_KEY, JSON.stringify(moveLayouts.value))
  }

  return { page, typeIconStyle, moveLayout, setTypeIconStyle, setMoveLayout }
}
