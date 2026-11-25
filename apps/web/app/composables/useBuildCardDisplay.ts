import type { MoveLayout, TypeIconStyle } from '@/lib/icons'

/**
 * How the page's Pokémon build cards show Type icons and list moves. Fixed at Compact and One
 * column for now: choosing them per page from Display options comes with DEV-226, which changes
 * this composable and adds the card's other branches.
 */
export function useBuildCardDisplay() {
  const typeIconStyle = computed<TypeIconStyle>(() => 'compact')
  const moveLayout = computed<MoveLayout>(() => 'one-column')
  return { typeIconStyle, moveLayout }
}
