// `pnpm screenshots [path] [--click <text>]...`: screenshots of pages of the running
// `pnpm preview` (DEV-184), at phone width (375 px) and desktop width (1280 px), logged in as the
// preview User. Each path can be followed by clicks to make first, such as opening a dialog
// (DEV-186); clicks before any path, or no arguments at all, are for the preview User's Team.
// Each shot starts afresh, so one shot's clicks never carry over to the next. A shot holds the
// whole page, including any pane that scrolls on its own. Writes
// .preview/screenshots/<page>[-<click>...]-<width>.png and prints each path.
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Locator, type Page, chromium } from '@playwright/test'
import { USAGE, parseShots, shotName } from './screenshot-args.ts'

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

const WIDTHS = { phone: { width: 375, height: 800 }, desktop: { width: 1280, height: 800 } }

// The one visible element with this exact text or accessible name: a button, link, form field,
// or any other element with that text, in that order. Waits for it to appear.
async function target(page: Page, text: string): Promise<Locator> {
  const kinds = [
    page.getByRole('button', { name: text, exact: true }),
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
      const context = await browser.newContext({ baseURL: state.url, viewport })
      // Logging in through the API sets the session cookie for the pages too.
      const login = await context.request.post('/api/auth/sign-in/email', {
        data: { email: state.email, password: state.password },
        headers: { origin: state.url },
      })
      if (!login.ok()) throw new Error(`Logging in as ${state.email} failed: ${login.status()}`)
      const page = await context.newPage()
      // The first visit to a page compiles it under `nuxt dev`, which can take a while.
      await page.goto(path, { waitUntil: 'networkidle', timeout: 120_000 })
      for (const click of shot.clicks) {
        await (await target(page, click)).click()
        await page.waitForLoadState('networkidle')
      }
      // An open dialog sits over the window, so show the window as the User sees it; a
      // full-page shot would leave a bottom sheet floating partway down the page.
      const dialogOpen = await page.getByRole('dialog').filter({ visible: true }).count()
      if (!dialogOpen) await fitScrollingPanes(page, viewport)
      const file = join(outDir, `${shotName(path, shot.clicks, width)}.png`)
      await page.screenshot({ path: file, fullPage: !dialogOpen, animations: 'disabled' })
      console.log(file)
      await context.close()
    }
  }
} catch (error) {
  console.error((error as Error).message)
  process.exitCode = 1
} finally {
  await browser.close()
}
