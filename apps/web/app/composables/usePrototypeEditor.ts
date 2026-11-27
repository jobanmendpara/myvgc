// PROTOTYPE (DEV-267), throwaway: never merge to main. The three-column build editor
// prototype's variant, and whether the page is in its desktop editing layout.
export const EDITOR_VARIANTS = ['A', 'B', 'C'] as const
export type EditorVariant = (typeof EDITOR_VARIANTS)[number]
export const EDITOR_VARIANT_LABELS: Record<EditorVariant, string> = {
  A: 'Whole form | editor | entry',
  B: 'Slot rail | editor | entry',
  C: 'Slot strip on top, editor | entry below',
}

export function usePrototypeEditor() {
  const route = useRoute()
  const router = useRouter()
  const variant = computed<EditorVariant>(() => {
    const value = String(route.query.variant ?? 'A')
    return (EDITOR_VARIANTS as readonly string[]).includes(value) ? (value as EditorVariant) : 'A'
  })
  const setVariant = (value: EditorVariant) => router.replace({ query: { ...route.query, variant: value } })
  /** Set while a build is open on desktop: the Teams list column steps aside for the columns. */
  const focus = useState('prototype-editor-focus', () => false)
  return { variant, setVariant, focus }
}
