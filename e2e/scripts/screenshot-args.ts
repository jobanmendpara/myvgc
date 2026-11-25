// Reads `pnpm screenshots`'s arguments into shots (DEV-186, DEV-198, DEV-199, DEV-227, DEV-228),
// and names their files. Kept apart from screenshots.ts so it can be tested without a browser or
// a running preview.
import { createHash } from 'node:crypto'
import {
  DEFAULT_SPRITE_STYLE,
  SPRITE_STYLES,
  SPRITE_STYLES_KEY,
  spritePageOf,
} from '../../apps/web/app/lib/sprites.ts'
import {
  buildCardPageOf,
  DEFAULT_MOVE_LAYOUT,
  DEFAULT_TYPE_ICON_STYLE,
  MOVE_LAYOUTS,
  MOVE_LAYOUTS_KEY,
  TYPE_ICON_STYLES,
  TYPE_ICON_STYLES_KEY,
} from '../../apps/web/app/lib/icons.ts'
import { MODE_KEY } from '../../apps/web/app/lib/theme.ts'

/**
 * A Device setting a page keeps for itself, stored before the page loads as a deep link would
 * find it. Each is an option, `--<flag> <value>`, and is named in the file name of every shot of a
 * page that has it, the default included, so a shot always says which it was taken in. To add one,
 * add an entry here: parsing, `--help`, storage and names follow.
 */
interface PageSetting {
  /** What `--help` and errors call it, such as `Sprite style`. */
  label: string
  values: readonly string[]
  /** What a page shows until the User picks one. */
  fallback: string
  /** Its part of the file name, before the value, such as `sprite`. */
  namePart: string
  /** The page `path` belongs to, or undefined on one without this setting. */
  pageOf(path: string): string | undefined
  /** Puts `value`, for `page`, in what's stored before the page loads. */
  store(storage: Record<string, string>, page: string, value: string): void
}

export const PAGE_SETTINGS = {
  'sprite-style': {
    label: 'Sprite style',
    values: SPRITE_STYLES,
    fallback: DEFAULT_SPRITE_STYLE,
    namePart: 'sprite',
    pageOf: spritePageOf,
    store(storage, page, value) {
      storage[SPRITE_STYLES_KEY] = JSON.stringify({ [page]: value })
    },
  },
  'type-icon-style': {
    label: 'Type icon style',
    values: TYPE_ICON_STYLES,
    fallback: DEFAULT_TYPE_ICON_STYLE,
    namePart: 'types',
    pageOf: buildCardPageOf,
    store(storage, page, value) {
      storage[TYPE_ICON_STYLES_KEY] = JSON.stringify({ [page]: value })
    },
  },
  'move-layout': {
    label: 'Move layout',
    values: MOVE_LAYOUTS,
    fallback: DEFAULT_MOVE_LAYOUT,
    namePart: 'moves',
    pageOf: buildCardPageOf,
    store(storage, page, value) {
      storage[MOVE_LAYOUTS_KEY] = JSON.stringify({ [page]: value })
    },
  },
} satisfies Record<string, PageSetting>

export type PageSettingFlag = keyof typeof PAGE_SETTINGS
const FLAGS = Object.keys(PAGE_SETTINGS) as PageSettingFlag[]
const settingOf = (flag: PageSettingFlag): PageSetting => PAGE_SETTINGS[flag]

/** A click: the element's visible text or accessible name, and the region it's in, if given. */
export interface Click {
  text: string
  /** A landmark's role (`main`, `complementary`) or a region's accessible name. */
  within?: string
}

/** One screenshot: a page, how the device is set up before it loads, and what to click first. */
export interface Shot {
  /** The page's path, such as `/teams`; undefined for the preview User's Team. */
  path?: string
  /** In order. */
  clicks: Click[]
  /** Page settings given for this shot; a page without one shows its default. */
  settings: Partial<Record<PageSettingFlag, string>>
  /** In the dark theme, stored as the theme Device setting is. */
  dark?: true
  /** At 2× pixel ratio, as on most phones, so a 1 px line can be judged. */
  double?: true
}

/** `--help`, as a result: print the usage and stop. */
export const HELP = 'help'

export const USAGE = [
  'Usage: pnpm screenshots [options] [path [options]]...',
  '  path                    a page, such as /teams; with no path, the preview User’s Team',
  '',
  'Options before the first path apply to every path. Options after a path apply to it alone, and',
  'a page setting given there replaces the one given before the first path.',
  '  --dark                  in the dark theme',
  '  --2x                    at 2× pixel ratio, to judge thin lines',
  '  --click <text>          click the element with that exact text or accessible name before the',
  '                          shot, such as --click "Display options for Teams" --click Badges',
  '  --within <region>       look for the next --click only inside this region: a landmark (main,',
  '                          complementary for the list pane, navigation, dialog) or a region’s',
  '                          accessible name. When several elements match a click, the error',
  '                          names a --within for each',
  'Page settings, stored before the page loads; every shot of a page that has one names it in',
  'its file name, the default too. Given after one path, give it for every path that has it:',
  ...FLAGS.map((flag) => {
    const { label, values, fallback } = settingOf(flag)
    return (
      `  --${flag} <value> `.padEnd(26) + `the ${label}: ${values.join(', ')} (default ${fallback})`
    )
  }),
  '  --help                  print this',
].join('\n')

/** The options of one part of the arguments: before the first path, or after a path. */
interface Part {
  path?: string
  clicks: Click[]
  settings: Partial<Record<PageSettingFlag, string>>
  dark?: true
  double?: true
}

/** Reads the arguments, or throws an Error whose message says what's wrong. */
export function parseShots(args: string[]): Shot[] | typeof HELP {
  if (args.includes('--help') || args.includes('-h')) return HELP
  const general: Part = { clicks: [], settings: {} }
  const paths: Part[] = []
  let part = general
  const where = () => part.path ?? 'every path'
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--') continue
    if (arg === '--click' || arg === '--within') {
      let within: string | undefined
      if (arg === '--within') {
        within = args[++i]
        if (within === undefined || within.startsWith('--') || within.trim() === '')
          throw new Error('--within needs the region to look in, such as --within main.')
        if (args[++i] !== '--click')
          throw new Error(`--within ${within} needs a --click right after it.`)
      }
      const text = args[++i]
      if (text === undefined || text.startsWith('--') || text.trim() === '')
        throw new Error('--click needs the text of what to click, such as --click Badges.')
      part.clicks.push(within === undefined ? { text } : { text, within })
    } else if (arg.startsWith('--') && FLAGS.includes(arg.slice(2) as PageSettingFlag)) {
      const flag = arg.slice(2) as PageSettingFlag
      const setting = settingOf(flag)
      const value = args[++i]
      if (!setting.values.some((known) => known === value))
        throw new Error(`${arg} needs one of ${setting.values.join(', ')}.`)
      if (part.path && !setting.pageOf(part.path))
        throw new Error(`${part.path} has no ${setting.label}, so ${arg} has nothing to set.`)
      if (part.settings[flag])
        throw new Error(`${arg} is given twice for ${where()}; give it once.`)
      part.settings[flag] = value
    } else if (arg === '--dark' || arg === '--2x') {
      const key = arg === '--dark' ? 'dark' : 'double'
      if (part[key]) throw new Error(`${arg} is given twice for ${where()}; give it once.`)
      part[key] = true
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option ${arg}.`)
    } else if (arg.startsWith('/')) {
      paths.push((part = { path: arg, clicks: [], settings: {} }))
    } else {
      throw new Error(`Give paths that start with /, such as /teams, not ${arg}.`)
    }
  }
  if (!paths.length) return [general]
  const shots = paths.map((own) => withGeneral(general, own))
  for (const flag of FLAGS) checkSetting(flag, general, paths)
  return shots
}

/** A path's shot: the options before the first path, then its own. */
function withGeneral(general: Part, own: Part): Shot {
  const shot: Shot = { path: own.path, clicks: [...general.clicks, ...own.clicks], settings: {} }
  for (const flag of FLAGS) {
    const value = own.settings[flag] ?? general.settings[flag]
    if (value && settingOf(flag).pageOf(own.path!)) shot.settings[flag] = value
  }
  if (own.dark || general.dark) shot.dark = true
  if (own.double || general.double) shot.double = true
  return shot
}

// Refuses a page setting that would be lost: given before the first path when no path has it, or
// given after some paths that have it but not others, which would silently show the default.
function checkSetting(flag: PageSettingFlag, general: Part, paths: Part[]) {
  const setting = settingOf(flag)
  const having = paths.filter((own) => setting.pageOf(own.path!))
  if (general.settings[flag]) {
    if (!having.length)
      throw new Error(`None of the paths has a ${setting.label}, so --${flag} has nothing to set.`)
    return
  }
  const without = having.filter((own) => !own.settings[flag])
  const given = having.find((own) => own.settings[flag])
  if (given && without.length)
    throw new Error(
      `--${flag} is given after ${given.path} but not after ${without.map((own) => own.path).join(', ')}, ` +
        `which would show the default. Give it before the first path for every path, or after each.`,
    )
}

/** What to put in the page's localStorage before it loads, for a shot of `path`. */
export function shotStorage(shot: Shot, path: string): Record<string, string> {
  const storage: Record<string, string> = {}
  for (const flag of FLAGS) {
    const setting = settingOf(flag)
    const page = setting.pageOf(path)
    const value = shot.settings[flag]
    if (value && page) setting.store(storage, page, value)
  }
  if (shot.dark) storage[MODE_KEY] = 'dark'
  return storage
}

/** Longest file name before the width, past which the name is cut and a hash added. */
const MAX_NAME = 100

/**
 * The file name for a shot of `path` at a width, without `.png`: the page, then each page setting
 * it has (the default when none is given), `dark` and `2x`, then each click, then the width, such
 * as `teams-abc-sprite-stacked-tiles-dark-sprite-style-phone`. A click given `--within` adds the
 * region before its text. A name too long to keep whole is cut and ends in a hash of the whole
 * shot, so shots never share a file.
 */
export function shotName(shot: Shot, path: string, width: string): string {
  const slug = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  const settings = FLAGS.flatMap((flag) => {
    const setting = settingOf(flag)
    if (!setting.pageOf(path)) return []
    return [`${setting.namePart}-${shot.settings[flag] ?? setting.fallback}`]
  })
  const parts = [
    path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'home',
    ...settings,
    shot.dark && 'dark',
    shot.double && '2x',
    ...shot.clicks.map((click) => slug([click.within, click.text].filter(Boolean).join(' '))),
  ]
  const name = parts.filter(Boolean).join('-')
  if (name.length <= MAX_NAME) return `${name}-${width}`
  const hash = createHash('sha256')
    .update(JSON.stringify([path, settings, shot.dark, shot.double, shot.clicks]))
    .digest('hex')
    .slice(0, 8)
  return `${name.slice(0, MAX_NAME - 9).replace(/-$/, '')}-${hash}-${width}`
}

/** Where a matched element sits: its kind, and the regions around it, innermost first. */
export interface Match {
  kind: string
  regions: string[]
}

/**
 * The error for a click that matches several elements: each match, and the `--within` that picks
 * it, the innermost region no other match is in.
 */
export function ambiguousClick(url: string, click: Click, matches: Match[]): string {
  const lines = matches.map((match, index) => {
    const others = matches.filter((_, other) => other !== index).flatMap((other) => other.regions)
    const pick = match.regions.find((region) => !others.includes(region))
    const place = match.regions.length ? ` in ${match.regions.join(' in ')}` : ''
    const how = pick
      ? `pick it with --within ${quote(pick)} --click ${quote(click.text)}`
      : 'no region tells it apart'
    return `  ${index + 1}. ${match.kind}${place}: ${how}`
  })
  const scope = click.within ? ` within ${click.within}` : ''
  return [
    `${matches.length} elements on ${url} match --click "${click.text}"${scope}:`,
    ...lines,
  ].join('\n')
}

const quote = (text: string) => (/^[\w-]+$/.test(text) ? text : `"${text}"`)
