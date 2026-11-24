// Reads `pnpm screenshots`'s arguments into shots (DEV-186). Kept apart from screenshots.ts so it
// can be tested without a browser or a running preview.

/** One screenshot: a page, and what to click on it, in order, before the shot. */
export interface Shot {
  /** The page's path, such as `/teams`; undefined for the preview User's Team. */
  path?: string
  /** Each element's visible text or accessible name, such as `Sprite style`. */
  clicks: string[]
}

export const USAGE = [
  'Usage: pnpm screenshots [path] [--click <text>]... [path [--click <text>]...]...',
  '  path            a page, such as /teams; with none before it, the preview User’s Team',
  '  --click <text>  click the element with that exact text or accessible name before the shot,',
  '                  such as --click "Sprite style" --click "Stacked tiles"',
].join('\n')

/** Reads the arguments, or throws an Error whose message says what's wrong. */
export function parseShots(args: string[]): Shot[] {
  const shots: Shot[] = []
  // Clicks given before any path are for the Team.
  let current: Shot | undefined
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--') continue
    if (arg === '--click') {
      const target = args[++i]
      if (target === undefined || target.startsWith('--') || target.trim() === '')
        throw new Error('--click needs the text of what to click, such as --click "Sprite style".')
      if (!current) shots.push((current = { clicks: [] }))
      current.clicks.push(target)
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

/** The file name for a shot at a width: ("/teams/abc", ["Sprite style"], "phone") is "teams-abc-sprite-style-phone". */
export function shotName(path: string, clicks: string[], width: string): string {
  const slug = (text: string) => text.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  const parts = [
    slug(path).slice(0, 80) || 'home',
    ...clicks.map((click) => slug(click.toLowerCase()).slice(0, 40)),
  ]
  return [...parts.filter(Boolean), width].join('-')
}
