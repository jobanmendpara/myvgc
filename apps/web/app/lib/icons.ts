// Item icons and Type icons (ADR 32): small pictures served from MyVGC's own origin, named by
// Showdown ID like Sprites (ADR 29), so the web app needs no table of files. An Item icon is
// decoration; a Type icon carries information, so it always has the type's name.
import type { MovePowerAccuracy, TypeId } from '@myvgc/core/schema'

/** The size of an Item icon beside an item's name, in CSS px (DEV-218). */
export const ITEM_ICON_SIZE = 16

/** The size of a Pokémon build's Type icons in the Compact Type icon style, in CSS px. */
export const TYPE_ICON_SIZE = 20

/** The size of a move's Type icon before its name, in CSS px. */
export const MOVE_TYPE_ICON_SIZE = 16

/** Where a held item's Item icon is served, from the item's Showdown ID. */
export const itemIconUrl = (item: string) => `/item-icons/${encodeURIComponent(item)}.webp`

/** Where a type's Type icon is served, from its Showdown ID. */
export const typeIconUrl = (type: TypeId) => `/type-icons/${type}.webp`

/**
 * A damaging move's power and accuracy as the build card shows it, such as `120/100`. A dash
 * stands in for power that varies (`—/100`) and for a move that never misses (`85/—`).
 */
export const powerAccuracyText = ({ power, accuracy }: MovePowerAccuracy) =>
  `${power ?? '—'}/${accuracy ?? '—'}`

/** The same for screen readers, such as "Power 120, accuracy 100". */
export const powerAccuracyLabel = ({ power, accuracy }: MovePowerAccuracy) =>
  `Power ${power ?? 'varies'}, accuracy ${accuracy ?? 'never misses'}`

// This file has no runtime imports, so `pnpm screenshots` can load it under plain Node.

/** The ways a Pokémon build card can show Type icons (DEV-218), as Display options lists them. */
export const TYPE_ICON_STYLES = ['compact', 'badges', 'labelled'] as const
export type TypeIconStyle = (typeof TYPE_ICON_STYLES)[number]

export const TYPE_ICON_STYLE_LABELS: Record<TypeIconStyle, string> = {
  compact: 'Compact',
  badges: 'Badges',
  labelled: 'Labelled',
}

/** What every page shows until the User picks a Type icon style for it. */
export const DEFAULT_TYPE_ICON_STYLE: TypeIconStyle = 'compact'

/** The ways a Pokémon build card can list its moves (DEV-218), as Display options lists them. */
export const MOVE_LAYOUTS = ['one-column', 'two-columns'] as const
export type MoveLayout = (typeof MOVE_LAYOUTS)[number]

export const MOVE_LAYOUT_LABELS: Record<MoveLayout, string> = {
  'one-column': 'One column',
  'two-columns': 'Two columns',
}

/** What every page shows until the User picks a Move layout for it. */
export const DEFAULT_MOVE_LAYOUT: MoveLayout = 'one-column'

// The build card's icon sizes in the Badges and Labelled styles, in CSS px (DEV-218). Compact
// uses TYPE_ICON_SIZE, MOVE_TYPE_ICON_SIZE and ITEM_ICON_SIZE.
export const BADGE_TYPE_ICON_SIZE = 24
/** A Badges Type icon over the corner of a Stacked tile's Sprite. */
export const STACKED_BADGE_TYPE_ICON_SIZE = 18
export const BADGE_MOVE_TYPE_ICON_SIZE = 20
export const LABELLED_TYPE_ICON_SIZE = 18
export const LABELLED_MOVE_TYPE_ICON_SIZE = 18
/** The Item icon beside the held item in the Badges and Labelled styles. */
export const LARGE_ITEM_ICON_SIZE = 20

/**
 * The pages with Pokémon build cards, each with its own Type icon style and Move layout, by the
 * first part of their path. Statistics shows Sprites but no build cards.
 */
export const BUILD_CARD_PAGES = ['teams', 'opponents', 'tournaments'] as const
export type BuildCardPage = (typeof BUILD_CARD_PAGES)[number]

const isBuildCardPage = (value: string): value is BuildCardPage =>
  BUILD_CARD_PAGES.some((page) => page === value)

/** The page a path belongs to, or undefined on one without build cards, such as Statistics. */
export function buildCardPageOf(path: string): BuildCardPage | undefined {
  const segment = path.split('/')[1] ?? ''
  return isBuildCardPage(segment) ? segment : undefined
}

/** Each page's Type icon style, a Device setting kept in localStorage under this key. */
export const TYPE_ICON_STYLES_KEY = 'myvgc-type-icon-styles'
export type TypeIconStyles = Partial<Record<BuildCardPage, TypeIconStyle>>

/** Each page's Move layout, a Device setting kept in localStorage under this key. */
export const MOVE_LAYOUTS_KEY = 'myvgc-move-layouts'
export type MoveLayouts = Partial<Record<BuildCardPage, MoveLayout>>

// Reads a stored object of one choice per page, keeping only known pages with known values.
function parsePageChoices<V extends string>(
  stored: string | null,
  values: readonly V[],
): Partial<Record<BuildCardPage, V>> {
  let value: unknown
  try {
    value = JSON.parse(stored ?? '{}')
  } catch {
    return {}
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const choices: Partial<Record<BuildCardPage, V>> = {}
  for (const [page, choice] of Object.entries(value)) {
    const known = values.find((option) => option === choice)
    if (isBuildCardPage(page) && known) choices[page] = known
  }
  return choices
}

/** Reads the stored Type icon styles. Anything else, or nothing at all, leaves a page Compact. */
export const parseTypeIconStyles = (stored: string | null): TypeIconStyles =>
  parsePageChoices(stored, TYPE_ICON_STYLES)

/** Reads the stored Move layouts. Anything else, or nothing at all, leaves a page One column. */
export const parseMoveLayouts = (stored: string | null): MoveLayouts =>
  parsePageChoices(stored, MOVE_LAYOUTS)

/** The Type icon style of a page; a page without build cards shows Compact. */
export const typeIconStyleOf = (
  styles: TypeIconStyles,
  page: BuildCardPage | undefined,
): TypeIconStyle => (page && styles[page]) || DEFAULT_TYPE_ICON_STYLE

/** The Move layout of a page; a page without build cards shows One column. */
export const moveLayoutOf = (layouts: MoveLayouts, page: BuildCardPage | undefined): MoveLayout =>
  (page && layouts[page]) || DEFAULT_MOVE_LAYOUT
