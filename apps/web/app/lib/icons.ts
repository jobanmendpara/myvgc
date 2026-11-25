// Item icons and Type icons (ADR 32): small pictures served from MyVGC's own origin, named by
// Showdown ID like Sprites (ADR 29), so the web app needs no table and no `@myvgc/core` (ADR 17).
// An Item icon is decoration; a Type icon carries information, so it always has the type's name.

/** The size of an Item icon beside an item's name, in CSS px (DEV-218). */
export const ITEM_ICON_SIZE = 16

/** The size of a Pokémon build's Type icons in the Compact Type icon style, in CSS px. */
export const TYPE_ICON_SIZE = 20

/** The size of a move's Type icon before its name, in CSS px. */
export const MOVE_TYPE_ICON_SIZE = 16

/** Where a held item's Item icon is served, from the item's Showdown ID. */
export const itemIconUrl = (item: string) => `/item-icons/${encodeURIComponent(item)}.webp`

/**
 * Where a type's Type icon is served. Takes a Showdown ID or a display name ("Fire" or "fire"),
 * since Showdown writes types capitalised.
 */
export const typeIconUrl = (type: string) => `/type-icons/${encodeURIComponent(typeId(type))}.webp`

/** A type's Showdown ID, from either its ID or its display name. */
export const typeId = (type: string) => type.toLowerCase()

/** A type's display name, such as "Fire", from either its ID or its display name. */
export const typeName = (type: string) => {
  const id = typeId(type)
  return id.charAt(0).toUpperCase() + id.slice(1)
}
