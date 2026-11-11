import { useMediaQuery } from '@vueuse/core'

/**
 * Whether the screen is wide enough (Tailwind's `lg`, 1024px) for the list and detail layout:
 * the list in a column on the left and the selected item beside it. Phones get full pages.
 */
export function useWideLayout() {
  return useMediaQuery('(min-width: 1024px)')
}
