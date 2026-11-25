// `pnpm screenshots [options] [path [options]]...`: screenshots of pages of the running
// `pnpm preview` (DEV-184), at phone width (375 px) and desktop width (1280 px), logged in as the
// preview User. Each path can be followed by page settings to store before the page loads, such as
// a Sprite style (DEV-198), the dark theme or 2× pixel ratio (DEV-199), and clicks to make first,
// such as opening a dialog (DEV-186), each optionally within a region (DEV-227) or the nth of
// several matches (DEV-232). Options before
// the first path apply to every path (DEV-228). `--help` lists them. With no path, the shot is the
// preview User's Team. Each shot starts afresh, so nothing carries over to the next. A shot holds
// the whole page, including any pane that scrolls on its own, once its images have loaded or
// failed. Both widths of a path are taken before either is saved, so a path that fails at one
// width saves neither (DEV-227).
// Writes .preview/screenshots/<page>[-<setting>-<value>...][-dark][-2x][-<click>...]-<width>.png,
// plus <name>.partN.png slices of a shot taller than SLICE image pixels, and prints each path.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Locator, type Page, chromium } from '@playwright/test'
import {
  type Click,
  HELP,
  type Match,
  USAGE,
  ambiguousClick,
  parseShots,
  shotName,
  shotStorage,
} from './screenshot-args.ts'

const root = fileURLToPath(new URL('../..', import.meta.url))
const outDir = join(root, '.preview/screenshots')

interface PreviewState {
  url: string
  email: string
  password: string
  teamPath: string
}

let shots
try {
  shots = parseShots(process.argv.slice(2))
} catch (error) {
  console.error(`${(error as Error).message}\n\n${USAGE}`)
  process.exit(64)
}
if (shots === HELP) {
  console.log(USAGE)
  process.exit(0)
}

let state: PreviewState
try {
  state = JSON.parse(readFileSync(join(root, '.preview/state.json'), 'utf8'))
} catch {
  console.error('No preview is running in this checkout. Start one with `pnpm preview`.')
  process.exit(1)
}
if (!state.teamPath) {
  console.error('The preview is still starting, or failed to. Run `pnpm preview` again.')
  process.exit(1)
}

/**
 * Shots taller than this, in image pixels, are also saved as slices this tall, which read without
 * shrinking.
 */
const SLICE = 1600

// Saves the shot in `dir`, and slices of it if it's tall. `scale` is the shot's pixel ratio.
async function save(page: Page, dir: string, name: string, fullPage: boolean, scale: number) {
  const shot = await page.screenshot({
    path: join(dir, `${name}.png`),
    fullPage,
    animations: 'disabled',
  })
  // A PNG's width and height are the big-endian numbers at bytes 16 and 20, in image pixels; a
  // clip is in CSS px.
  if (shot.readUInt32BE(20) <= SLICE) return
  const width = shot.readUInt32BE(16) / scale
  const height = shot.readUInt32BE(20) / scale
  const step = SLICE / scale
  for (let y = 0, part = 1; y < height; y += step, part++) {
    const slice = join(dir, `${name}.part${part}.png`)
    const clip = { x: 0, y, width, height: Math.min(step, height - y) }
    await page.screenshot({ path: slice, fullPage: true, clip, animations: 'disabled' })
  }
}

// Moves a path's shots from `dir` into the screenshots folder and prints each one. Slices from
// an earlier, taller shot of the same name are removed first.
function keep(dir: string, names: string[]) {
  for (const name of names)
    for (const old of readdirSync(outDir))
      if (old.startsWith(`${name}.part`)) rmSync(join(outDir, old))
  for (const file of readdirSync(dir).sort()) {
    renameSync(join(dir, file), join(outDir, file))
    console.log(join(outDir, file))
  }
}

const WIDTHS = { phone: { width: 375, height: 800 }, desktop: { width: 1280, height: 800 } }

// Landmarks an unnamed region can be picked by, with `--within <role>`.
const LANDMARKS = [
  'main',
  'navigation',
  'complementary',
  'banner',
  'contentinfo',
  'dialog',
  'search',
]
// Roles a region can be picked by, with `--within <accessible name>`.
const NAMED_REGIONS = [
  ...LANDMARKS,
  'region',
  'form',
  'group',
  'list',
  'listbox',
  'radiogroup',
  'table',
  'tabpanel',
  'alertdialog',
]
type Role = Parameters<Page['getByRole']>[0]

// Waits up to 15 s for any of `kinds` to match, and returns the first that does.
async function firstMatch(page: Page, kinds: Locator[]): Promise<Locator | undefined> {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    for (const locator of kinds) if ((await locator.count()) > 0) return locator
    await page.waitForTimeout(200)
  }
}

// The one visible region a `--within` names: a landmark by its role, or any region by its
// accessible name.
async function region(page: Page, within: string): Promise<Locator> {
  const kinds = [
    ...(LANDMARKS.includes(within) ? [page.getByRole(within as Role)] : []),
    ...NAMED_REGIONS.map((role) => page.getByRole(role as Role, { name: within, exact: true })),
  ].map((locator) => locator.filter({ visible: true }))
  const found = await firstMatch(page, kinds)
  if (!found) throw new Error(`No region on ${page.url()} is a ${within} or is named "${within}".`)
  const count = await found.count()
  if (count > 1) throw new Error(`${count} regions on ${page.url()} match --within "${within}".`)
  return found
}

// Where each element sits, for telling them apart: its kind, and the landmarks and named regions
// around it, innermost first, as `--within` takes them.
async function describe(elements: Locator): Promise<Match[]> {
  return elements.evaluateAll(
    (nodes, { landmarks, named }) => {
      const byTag: Record<string, string> = {
        main: 'main',
        nav: 'navigation',
        aside: 'complementary',
        dialog: 'dialog',
        ul: 'list',
        ol: 'list',
        table: 'table',
        form: 'form',
        section: 'region',
        a: 'link',
        button: 'button',
        li: 'list item',
      }
      const roleOf = (node: Element) =>
        node.getAttribute('role') ?? byTag[node.tagName.toLowerCase()] ?? node.tagName.toLowerCase()
      const nameOf = (node: Element) => {
        const label = node.getAttribute('aria-label')
        if (label) return label.trim()
        const ids = node.getAttribute('aria-labelledby') ?? ''
        return ids
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
          .join(' ')
          .trim()
      }
      return nodes.map((node) => {
        const regions: string[] = []
        for (let up = node.parentElement; up; up = up.parentElement) {
          const role = roleOf(up)
          const name = nameOf(up)
          if (name && named.includes(role)) regions.push(name)
          else if (landmarks.includes(role)) regions.push(role)
        }
        const tag = node.tagName.toLowerCase()
        const kind =
          node instanceof HTMLInputElement
            ? `a ${node.type} input`
            : (node.getAttribute('role') ?? byTag[tag] ?? `text in a <${tag}>`)
        return {
          kind: kind.startsWith('text') || kind.startsWith('a ') ? kind : `a ${kind}`,
          regions,
        }
      })
    },
    { landmarks: LANDMARKS, named: NAMED_REGIONS },
  )
}

// The one visible element with this exact text or accessible name, inside the click's region if
// it names one: a button, link, form field, or any other element with that text, in that order.
// Waits for it to appear. When several match, takes the click's `--nth` of them, or else says
// where each is and how to pick it.
async function target(page: Page, click: Click): Promise<Locator> {
  const scope = click.within ? await region(page, click.within) : page
  const { text } = click
  const kinds = [
    scope.getByRole('button', { name: text, exact: true }),
    scope.getByRole('radio', { name: text, exact: true }),
    scope.getByRole('checkbox', { name: text, exact: true }),
    scope.getByRole('link', { name: text, exact: true }),
    scope.getByLabel(text, { exact: true }),
    scope.getByText(text, { exact: true }),
  ].map((locator) => locator.filter({ visible: true }))
  const found = await firstMatch(page, kinds)
  const where = click.within ? ` within ${click.within}` : ''
  if (!found) throw new Error(`Nothing on ${page.url()}${where} has the text or name "${text}".`)
  const count = await found.count()
  if (click.nth) {
    if (click.nth > count)
      throw new Error(
        `--nth ${click.nth} --click "${text}"${where}: only ${count} element${count === 1 ? '' : 's'} on ${page.url()} match.`,
      )
    return found.nth(click.nth - 1)
  }
  if (count > 1) throw new Error(ambiguousClick(page.url(), click, await describe(found)))
  return found
}

// Clicks the element. A radio or checkbox inside a label is clicked through its label, as a User
// would: the input itself may be visually hidden, as each List style's is behind its icon.
async function click(page: Page, step: Click) {
  const element = await target(page, step)
  const checkable = await element.evaluate(
    (node) =>
      node instanceof HTMLInputElement && (node.type === 'radio' || node.type === 'checkbox'),
  )
  const label = page.locator('label').filter({ has: element })
  try {
    if (checkable && (await label.count()) === 1) await label.click()
    else await element.click()
  } catch (error) {
    // Playwright's message goes on to a long call log; its first line says what went wrong.
    const reason = (error as Error).message.split('\n')[0]
    throw new Error(`Clicking "${step.text}" on ${page.url()} failed: ${reason}`, { cause: error })
  }
  await page.waitForLoadState('networkidle')
}

// Loads every image now, even lazy ones below the fold, and waits until each has loaded or
// failed, and a failed Sprite has become its dashed gap.
async function settleImages(page: Page) {
  await page.evaluate(() => {
    for (const image of Array.from(document.images)) image.loading = 'eager'
  })
  try {
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete), {
      timeout: 15_000,
    })
  } catch {
    console.error(`Some images on ${page.url()} were still loading after 15 s.`)
  }
  // A failed image swaps for its gap on the next render.
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  )
}

// On wide screens some pages scroll inside a pane rather than the window, so a full-page shot
// would stop at the window's height. Make the window tall enough for the longest such pane.
async function fitScrollingPanes(page: Page, viewport: { width: number; height: number }) {
  for (let round = 0; round < 3; round++) {
    const hidden = await page.evaluate(() => {
      let most = 0
      for (const element of Array.from(document.querySelectorAll('*'))) {
        const { overflowY } = getComputedStyle(element)
        if (overflowY !== 'auto' && overflowY !== 'scroll') continue
        most = Math.max(most, element.scrollHeight - element.clientHeight)
      }
      return most
    })
    if (hidden <= 1) return
    const size = page.viewportSize() ?? viewport
    await page.setViewportSize({
      width: size.width,
      height: Math.min(size.height + hidden, 20_000),
    })
    await page.waitForTimeout(100)
  }
}

mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
// Where the path being taken keeps its shots until both widths are done.
let taking: string | undefined
try {
  for (const shot of shots) {
    const path = shot.path ?? state.teamPath
    taking = mkdtempSync(join(outDir, '.taking-'))
    const names: string[] = []
    for (const [width, viewport] of Object.entries(WIDTHS)) {
      // A fresh context each time, so a Sprite style picked in one shot stays out of the next.
      const context = await browser.newContext({
        baseURL: state.url,
        viewport,
        deviceScaleFactor: shot.double ? 2 : 1,
      })
      try {
        // Logging in through the API sets the session cookie for the pages too.
        const login = await context.request.post('/api/auth/sign-in/email', {
          data: { email: state.email, password: state.password },
          headers: { origin: state.url },
        })
        if (!login.ok()) throw new Error(`Logging in as ${state.email} failed: ${login.status()}`)
        const storage = shotStorage(shot, path)
        // Set once, before the first page loads: a later page keeps whatever the clicks changed.
        if (Object.keys(storage).length)
          await context.addInitScript((items) => {
            for (const [key, value] of Object.entries(items))
              if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
          }, storage)
        const page = await context.newPage()
        // The first visit to a page compiles it under `nuxt dev`, which can take a while.
        await page.goto(path, { waitUntil: 'networkidle', timeout: 120_000 })
        for (const step of shot.clicks) await click(page, step)
        // An open dialog sits over the window, so show the window as the User sees it; a
        // full-page shot would leave a bottom sheet floating partway down the page.
        const dialogOpen = await page.getByRole('dialog').filter({ visible: true }).count()
        if (!dialogOpen) await fitScrollingPanes(page, viewport)
        await settleImages(page)
        const name = shotName(shot, path, width)
        await save(page, taking, name, !dialogOpen, shot.double ? 2 : 1)
        names.push(name)
      } catch (error) {
        const message = `${(error as Error).message}\nAt ${width} width, so no shot of ${path} was saved.`
        throw new Error(message, { cause: error })
      } finally {
        await context.close()
      }
    }
    keep(taking, names)
    rmSync(taking, { recursive: true, force: true })
    taking = undefined
  }
} catch (error) {
  console.error((error as Error).message)
  process.exitCode = 1
} finally {
  if (taking) rmSync(taking, { recursive: true, force: true })
  await browser.close()
}
