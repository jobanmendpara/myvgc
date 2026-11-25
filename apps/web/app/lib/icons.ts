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

/** The ways a Pokémon build card can show Type icons (DEV-218). Only Compact is built so far. */
export const TYPE_ICON_STYLES = ['compact', 'badges', 'labelled'] as const
export type TypeIconStyle = (typeof TYPE_ICON_STYLES)[number]

/** The ways a Pokémon build card can list its moves (DEV-218). Only One column is built so far. */
export const MOVE_LAYOUTS = ['one-column', 'two-columns'] as const
export type MoveLayout = (typeof MOVE_LAYOUTS)[number]
