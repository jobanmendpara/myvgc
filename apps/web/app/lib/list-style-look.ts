import type { ListStyle } from '@myvgc/core/schema'

type ClassValue = string | string[]

/** How one List style looks, on wide screens (`wide`) or on their own page. */
export interface ListStyleLook {
  /** The list column's width on wide screens. */
  columnWidth: string
  /** Whether the rows show under the list's group headings. */
  headings: boolean
  /** Around all the rows. */
  frame: (wide: boolean) => string
  /** Each group's list of rows. */
  list: (wide: boolean) => string
  /** Each row's link, including how it marks the selected row. */
  link: (wide: boolean) => ClassValue
}

const focus = 'outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

/**
 * Every List style's look, in one place: ListColumn and ListRows read it and the row components
 * fill one slot per List style, so a fourth List style is one more entry here. Each marks the
 * selected row its own way: an accent bar (Compact), a raised card with a primary ring
 * (Detailed) or a primary tint (Grouped).
 */
export const LIST_STYLE_LOOKS: Record<ListStyle, ListStyleLook> = {
  compact: {
    columnWidth: 'w-[320px]',
    headings: false,
    frame: () => '',
    list: (wide) =>
      wide ? 'flex flex-col py-1' : 'flex flex-col divide-y overflow-hidden rounded-lg border',
    link: (wide) => [
      focus,
      'hover:bg-muted/50 flex items-center justify-between gap-3 border-l-4 border-transparent px-3 text-sm focus-visible:ring-inset',
      'aria-[current=page]:border-primary aria-[current=page]:bg-muted aria-[current=page]:font-medium',
      wide ? 'py-2' : 'py-3',
    ],
  },
  detailed: {
    columnWidth: 'w-[360px]',
    headings: false,
    frame: () => '',
    list: (wide) => (wide ? 'flex flex-col gap-1 p-2' : 'grid grid-cols-1 gap-3 md:grid-cols-2'),
    link: (wide) => [
      focus,
      'hover:bg-muted/50 flex flex-col rounded-lg border',
      'aria-[current=page]:border-primary aria-[current=page]:bg-card aria-[current=page]:ring-primary aria-[current=page]:shadow-sm aria-[current=page]:ring-1',
      wide ? 'gap-1.5 border-transparent p-3 text-sm' : 'h-full gap-2 p-4',
    ],
  },
  grouped: {
    columnWidth: 'w-[320px]',
    headings: true,
    frame: (wide) => (wide ? '' : 'overflow-clip rounded-lg border'),
    list: () => 'divide-y',
    link: (wide) => [
      focus,
      'hover:bg-muted/50 flex flex-col gap-0.5 px-3 text-sm focus-visible:ring-inset',
      'aria-[current=page]:bg-primary/10',
      wide ? 'py-2' : 'py-2.5',
    ],
  },
}
