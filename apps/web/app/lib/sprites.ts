// Sprites (ADR 29): each species or form's small picture, a file served from MyVGC's own origin
// and named by its Showdown ID, so the web app needs no table and no `@myvgc/core` (ADR 17).
// A Sprite is decoration: when one can't be shown, a gap of its size keeps rows aligned.

/** No Sprite is ever drawn larger than this, in CSS px (ADR 29). */
export const MAX_SPRITE_SIZE = 48

/** The ways a page can show Sprites, in the order the Sprite style dialog lists them. */
export const SPRITE_STYLES = ['inline', 'leading-slot', 'stacked-tiles'] as const
export type SpriteStyle = (typeof SPRITE_STYLES)[number]

export const SPRITE_STYLE_LABELS: Record<SpriteStyle, string> = {
  inline: 'Inline',
  'leading-slot': 'Leading slot',
  'stacked-tiles': 'Stacked tiles',
}

/** What every page shows until the User picks a Sprite style for it. */
export const DEFAULT_SPRITE_STYLE: SpriteStyle = 'inline'

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
  'tournament-team',
  'build-editor-heading',
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
    'tournament-team': 20,
    'build-editor-heading': 32,
  },
  'leading-slot': {
    'build-card': 48,
    'build-slot': 40,
    'team-row-grouped': 24,
    'team-row-detailed': 28,
    'opponent-team': 40,
    'opponent-team-editor': 32,
    'games-button': 32,
    'statistics-row': 32,
    'species-picker-choice': 32,
    'species-picker-option': 32,
    'tournament-team': 28,
    'build-editor-heading': 48,
  },
  'stacked-tiles': {
    'build-card': 48,
    'build-slot': 40,
    'team-row-grouped': 32,
    'team-row-detailed': 40,
    'opponent-team': 48,
    'opponent-team-editor': 40,
    'games-button': 48,
    'statistics-row': 32,
    'species-picker-choice': 40,
    'species-picker-option': 32,
    'tournament-team': 40,
    'build-editor-heading': 48,
  },
}

/** The size of a Sprite on a surface in a Sprite style, never more than `MAX_SPRITE_SIZE`. */
export const spriteSize = (surface: SpriteSurface, style: SpriteStyle = DEFAULT_SPRITE_STYLE) =>
  Math.min(SPRITE_SIZES[style][surface], MAX_SPRITE_SIZE)

/** Where a species or form's Sprite is served, from the Showdown ID stored on the build. */
export const spriteUrl = (species: string) => `/sprites/${encodeURIComponent(species)}.webp`

/** The species of a Statistics row, whose key is one species ID or a Lead pair's two. */
export const rowSpecies = (key: string) => key.split(' ').filter(Boolean)

/**
 * The pages that show Sprites, by the first part of their path, each with its own Sprite style.
 * Species pickers and the Pokémon build editor follow the page they're on.
 */
export const SPRITE_PAGES = {
  teams: 'Teams',
  opponents: 'Opponents',
  tournaments: 'Tournaments',
  statistics: 'Statistics',
} as const
export type SpritePage = keyof typeof SPRITE_PAGES

const isSpritePage = (value: string): value is SpritePage => Object.hasOwn(SPRITE_PAGES, value)
const isSpriteStyle = (value: unknown): value is SpriteStyle =>
  SPRITE_STYLES.some((style) => style === value)

/** The page a path belongs to, or undefined on one that shows no Sprites, such as Settings. */
export function spritePageOf(path: string): SpritePage | undefined {
  const segment = path.split('/')[1] ?? ''
  return isSpritePage(segment) ? segment : undefined
}

/** Each page's Sprite style, a Device setting kept in localStorage under this key. */
export const SPRITE_STYLES_KEY = 'myvgc-sprite-styles'
export type SpriteStyles = Partial<Record<SpritePage, SpriteStyle>>

/**
 * Reads what's stored, keeping only known pages with known styles. Anything else, or nothing at
 * all, leaves a page Inline.
 */
export function parseSpriteStyles(stored: string | null): SpriteStyles {
  let value: unknown
  try {
    value = JSON.parse(stored ?? '{}')
  } catch {
    return {}
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const styles: SpriteStyles = {}
  for (const [page, style] of Object.entries(value))
    if (isSpritePage(page) && isSpriteStyle(style)) styles[page] = style
  return styles
}

/** The Sprite style of a page; a path outside the four pages shows Inline. */
export const spriteStyleOf = (styles: SpriteStyles, page: SpritePage | undefined): SpriteStyle =>
  (page && styles[page]) || DEFAULT_SPRITE_STYLE
