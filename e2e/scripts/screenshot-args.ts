// Reads `pnpm screenshots`'s arguments into shots (DEV-186, DEV-198, DEV-199), and names their files. Kept
// apart from screenshots.ts so it can be tested without a browser or a running preview.
import { createHash } from 'node:crypto'
import {
  SPRITE_STYLES,
  SPRITE_STYLES_KEY,
  type SpriteStyle,
  spritePageOf,
} from '../../apps/web/app/lib/sprites.ts'
import { MODE_KEY } from '../../apps/web/app/lib/theme.ts'

/** One screenshot: a page, how the device is set up before it loads, and what to click first. */
export interface Shot {
  /** The page's path, such as `/teams`; undefined for the preview User's Team. */
  path?: string
  /** Each element's visible text or accessible name, such as `Sprite style`, in order. */
  clicks: string[]
  /** The Sprite style stored for the shot's page before it loads, as a deep link would find it. */
  spriteStyle?: SpriteStyle
  /** In the dark theme, stored as the theme Device setting is. */
  dark?: true
  /** At 2× pixel ratio, as on most phones, so a 1 px line can be judged. */
  double?: true
}

/** `--help`, as a result: print the usage and stop. */
export const HELP = 'help'

export const USAGE = [
  'Usage: pnpm screenshots [path] [options] [path [options]]...',
  '  path                    a page, such as /teams; options before any path are for the preview',
  '                          User’s Team, and each path’s options follow it',
  '  --dark                  in the dark theme',
  '  --2x                    at 2× pixel ratio, to judge thin lines',
  '  --click <text>          click the element with that exact text or accessible name before the',
  '                          shot, such as --click "Sprite style" --click "Stacked tiles"',
  `  --sprite-style <style>  store this Sprite style for the page before it loads: ${SPRITE_STYLES.join(', ')}`,
  '  --help                  print this',
].join('\n')

/** Reads the arguments, or throws an Error whose message says what's wrong. */
export function parseShots(args: string[]): Shot[] | typeof HELP {
  if (args.includes('--help') || args.includes('-h')) return HELP
  const shots: Shot[] = []
  // Options given before any path are for the Team.
  let current: Shot | undefined
  const shot = () => {
    if (!current) shots.push((current = { clicks: [] }))
    return current
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--') continue
    if (arg === '--click') {
      const target = args[++i]
      if (target === undefined || target.startsWith('--') || target.trim() === '')
        throw new Error('--click needs the text of what to click, such as --click "Sprite style".')
      shot().clicks.push(target)
    } else if (arg === '--sprite-style') {
      const style = args[++i]
      if (!SPRITE_STYLES.some((known) => known === style))
        throw new Error(`--sprite-style needs one of ${SPRITE_STYLES.join(', ')}.`)
      const page = shot()
      if (page.path && !spritePageOf(page.path))
        throw new Error(`${page.path} shows no Sprites, so --sprite-style has nothing to set.`)
      if (page.spriteStyle)
        throw new Error(`${page.path ?? 'The Team'} has two --sprite-style options; give one.`)
      page.spriteStyle = style as SpriteStyle
    } else if (arg === '--dark' || arg === '--2x') {
      const page = shot()
      const key = arg === '--dark' ? 'dark' : 'double'
      if (page[key]) throw new Error(`${page.path ?? 'The Team'} has ${arg} twice; give it once.`)
      page[key] = true
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option ${arg}.`)
    } else if (arg.startsWith('/')) {
      shots.push((current = { path: arg, clicks: [] }))
    } else {
      throw new Error(`Give paths that start with /, such as /teams, not ${arg}.`)
    }
  }
  return shots.length ? shots : [{ clicks: [] }]
}

/** What to put in the page's localStorage before it loads, for a shot of `path`. */
export function shotStorage(shot: Shot, path: string): Record<string, string> {
  const storage: Record<string, string> = {}
  const page = spritePageOf(path)
  if (shot.spriteStyle && page)
    storage[SPRITE_STYLES_KEY] = JSON.stringify({ [page]: shot.spriteStyle })
  if (shot.dark) storage[MODE_KEY] = 'dark'
  return storage
}

/** Longest file name before the width, past which the name is cut and a hash added. */
const MAX_NAME = 100

/**
 * The file name for a shot of `path` at a width, without `.png`: the page, then its Sprite style,
 * `dark` and `2x`, then each click, then the width, such as
 * `teams-abc-sprite-stacked-tiles-dark-sprite-style-phone`.
 * A name too long to keep whole is cut and ends in a hash of the whole shot, so shots never share
 * a file.
 */
export function shotName(shot: Shot, path: string, width: string): string {
  const slug = (text: string) => text.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  const parts = [
    slug(path) || 'home',
    shot.spriteStyle && `sprite-${shot.spriteStyle}`,
    shot.dark && 'dark',
    shot.double && '2x',
    ...shot.clicks.map((click) => slug(click.toLowerCase())),
  ]
  const name = parts.filter(Boolean).join('-')
  if (name.length <= MAX_NAME) return `${name}-${width}`
  const hash = createHash('sha256')
    .update(JSON.stringify([path, shot.spriteStyle, shot.dark, shot.double, shot.clicks]))
    .digest('hex')
    .slice(0, 8)
  return `${name.slice(0, MAX_NAME - 9).replace(/-$/, '')}-${hash}-${width}`
}
