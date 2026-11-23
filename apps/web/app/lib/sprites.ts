// Sprites (ADR 29): each species or form's small picture, a file served from MyVGC's own origin
// and named by its Showdown ID, so the web app needs no table and no `@myvgc/core` (ADR 17).
// A Sprite is decoration: when one can't be shown, a gap of its size keeps rows aligned.

/** No Sprite is ever drawn larger than this, in CSS px (ADR 29). */
export const MAX_SPRITE_SIZE = 48

/**
 * The ways a page can show Sprites. Only Inline ships so far; the Leading slot and Stacked tiles
 * styles join this list, and `SPRITE_SIZES`, when the User can pick one per page.
 */
export const SPRITE_STYLES = ['inline'] as const
export type SpriteStyle = (typeof SPRITE_STYLES)[number]

/** Each place the web app shows a Sprite. Team rows in the Compact List style show none. */
export const SPRITE_SURFACES = [
  'build-card',
  'build-slot',
  'team-row-grouped',
  'team-row-detailed',
  'opponent-team',
  'opponent-team-editor',
  'games-button',
  'statistics-row',
  'species-picker-choice',
  'species-picker-option',
] as const
export type SpriteSurface = (typeof SPRITE_SURFACES)[number]

/** A Sprite's size on each surface in each Sprite style, in CSS px (DEV-172). */
export const SPRITE_SIZES: Record<SpriteStyle, Record<SpriteSurface, number>> = {
  inline: {
    'build-card': 32,
    'build-slot': 24,
    'team-row-grouped': 16,
    'team-row-detailed': 20,
    'opponent-team': 20,
    'opponent-team-editor': 24,
    'games-button': 24,
    'statistics-row': 24,
    'species-picker-choice': 24,
    'species-picker-option': 24,
  },
}

/** The size of a Sprite on a surface in a Sprite style, never more than `MAX_SPRITE_SIZE`. */
export const spriteSize = (surface: SpriteSurface, style: SpriteStyle = 'inline') =>
  Math.min(SPRITE_SIZES[style][surface], MAX_SPRITE_SIZE)

/** Where a species or form's Sprite is served, from the Showdown ID stored on the build. */
export const spriteUrl = (species: string) => `/sprites/${encodeURIComponent(species)}.webp`

/** The species of a Statistics row, whose key is one species ID or a Lead pair's two. */
export const rowSpecies = (key: string) => key.split(' ').filter(Boolean)
