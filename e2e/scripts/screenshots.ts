// `pnpm screenshots [path] [options]...`: screenshots of pages of the running `pnpm preview`
// (DEV-184), at phone width (375 px) and desktop width (1280 px), logged in as the preview User.
// Each path can be followed by a Sprite style to store before the page loads (DEV-198), the dark
// theme or 2× pixel ratio (DEV-199), and clicks to make first, such as opening a dialog (DEV-186);
// `--help` lists them. Options before any path, or no arguments at all, are for the preview
// User's Team. Each shot starts afresh, so nothing carries over to the next. A shot holds the
// whole page, including any pane that scrolls on its own, once its images have loaded or failed.
// Writes .preview/screenshots/<page>[-sprite-<style>][-dark][-2x][-<click>...]-<width>.png, plus
// <name>.partN.png slices of a shot taller than SLICE image pixels, and prints each path.
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Locator, type Page, chromium } from '@playwright/test'
import { HELP, USAGE, parseShots, shotName, shotStorage } from './screenshot-args.ts'

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

// Saves the shot, and slices of it if it's tall, and prints each path. Slices from an earlier,
// taller shot of the same name are removed first. `scale` is the shot's pixel ratio.
async function save(page: Page, name: string, fullPage: boolean, scale: number) {
  const file = join(outDir, `${name}.png`)
  for (const old of readdirSync(outDir))
    if (old.startsWith(`${name}.part`)) rmSync(join(outDir, old))
  const shot = await page.screenshot({ path: file, fullPage, animations: 'disabled' })
  console.log(file)
  // A PNG's width and height are the big-endian numbers at bytes 16 and 20, in image pixels; a
  // clip is in CSS px.
  if (shot.readUInt32BE(20) <= SLICE) return
  const width = shot.readUInt32BE(16) / scale
  const height = shot.readUInt32BE(20) / scale
  const step = SLICE / scale
  for (let y = 0, part = 1; y < height; y += step, part++) {
    const slice = join(outDir, `${name}.part${part}.png`)
    const clip = { x: 0, y, width, height: Math.min(step, height - y) }
    await page.screenshot({ path: slice, fullPage: true, clip, animations: 'disabled' })
    console.log(slice)
  }
}

const WIDTHS = { phone: { width: 375, height: 800 }, desktop: { width: 1280, height: 800 } }

// The one visible element with this exact text or accessible name: a button, link, form field,
// or any other element with that text, in that order. Waits for it to appear.
async function target(page: Page, text: string): Promise<Locator> {
  const kinds = [
    page.getByRole('button', { name: text, exact: true }),
    page.getByRole('radio', { name: text, exact: true }),
    page.getByRole('checkbox', { name: text, exact: true }),
    page.getByRole('link', { name: text, exact: true }),
    page.getByLabel(text, { exact: true }),
    page.getByText(text, { exact: true }),
  ].map((locator) => locator.filter({ visible: true }))
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    for (const locator of kinds) {
      const count = await locator.count()
      if (count === 1) return locator
      if (count > 1)
        throw new Error(`${count} elements on ${page.url()} match --click "${text}"; name one.`)
    }
    await page.waitForTimeout(200)
  }
  throw new Error(`Nothing on ${page.url()} has the text or name "${text}".`)
}

// Clicks the element. A radio or checkbox inside a label is clicked through its label, as a User
// would: the input itself may be visually hidden, as each List style's is behind its icon.
async function click(page: Page, text: string) {
  const element = await target(page, text)
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
    throw new Error(`Clicking "${text}" on ${page.url()} failed: ${reason}`, { cause: error })
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
try {
  for (const [width, viewport] of Object.entries(WIDTHS)) {
    for (const shot of shots) {
      const path = shot.path ?? state.teamPath
      // A fresh context each time, so a Sprite style picked in one shot stays out of the next.
      const context = await browser.newContext({
        baseURL: state.url,
        viewport,
        deviceScaleFactor: shot.double ? 2 : 1,
      })
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
      for (const text of shot.clicks) await click(page, text)
      // An open dialog sits over the window, so show the window as the User sees it; a
      // full-page shot would leave a bottom sheet floating partway down the page.
      const dialogOpen = await page.getByRole('dialog').filter({ visible: true }).count()
      if (!dialogOpen) await fitScrollingPanes(page, viewport)
      await settleImages(page)
      await save(page, shotName(shot, path, width), !dialogOpen, shot.double ? 2 : 1)
      await context.close()
    }
  }
} catch (error) {
  console.error((error as Error).message)
  process.exitCode = 1
} finally {
  await browser.close()
}
