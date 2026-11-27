// PROTOTYPE (DEV-265), throwaway: never merge to main. Settings for the detail tooltips
// prototype: the variant (in `?variant=`) and whether to act as a touch screen.
import { useMediaQuery } from '@vueuse/core'

export const TOOLTIP_VARIANTS = ['A', 'B', 'C'] as const
export type TooltipVariant = (typeof TOOLTIP_VARIANTS)[number]
export const TOOLTIP_VARIANT_LABELS: Record<TooltipVariant, string> = {
  A: 'Short card · ⓘ popover · picker preview pane',
  B: 'Full card · name links · ⓘ sheet',
  C: 'One ⓘ per card, details inline',
}
export type DetailKind = 'moves' | 'items' | 'abilities' | 'types'

export function usePrototypeTooltips() {
  const route = useRoute()
  const router = useRouter()
  const variant = computed<TooltipVariant>(() => {
    const value = String(route.query.variant ?? 'A')
    return (TOOLTIP_VARIANTS as readonly string[]).includes(value) ? (value as TooltipVariant) : 'A'
  })
  function setVariant(value: TooltipVariant) {
    router.replace({ query: { ...route.query, variant: value } })
  }
  /** auto follows the device; touch or mouse forces one, to try a phone's way on desktop. */
  const input = useState<'auto' | 'touch' | 'mouse'>('prototype-tooltips-input', () => 'auto')
  const noHover = useMediaQuery('(hover: none)')
  const touch = computed(() => (input.value === 'auto' ? noHover.value : input.value === 'touch'))
  return { variant, setVariant, input, touch }
}
