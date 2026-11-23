// `pnpm screenshots [path...]`: screenshots of pages of the running `pnpm preview` (DEV-184), at
// phone width (375 px) and desktop width (1280 px), logged in as the preview User. With no paths it
// takes the preview User's Team. Writes .preview/screenshots/<page>-<width>.png and prints each path.
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('../..', import.meta.url))
const outDir = join(root, '.preview/screenshots')

interface PreviewState {
  url: string
  email: string
  password: string
  teamPath: string
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

const paths = process.argv.slice(2).filter((arg) => arg !== '--')
if (paths.some((path) => !path.startsWith('/'))) {
  console.error('Give paths that start with /, such as /teams or /dashboard.')
  process.exit(64)
}
const WIDTHS = { phone: { width: 375, height: 800 }, desktop: { width: 1280, height: 800 } }

// "/teams/abc?x=1" becomes "teams-abc-x-1"; "/" becomes "home".
const slug = (path: string) =>
  path
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'home'

mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
try {
  for (const [name, viewport] of Object.entries(WIDTHS)) {
    const context = await browser.newContext({ baseURL: state.url, viewport })
    // Logging in through the API sets the session cookie for the pages too.
    const login = await context.request.post('/api/auth/sign-in/email', {
      data: { email: state.email, password: state.password },
      headers: { origin: state.url },
    })
    if (!login.ok()) throw new Error(`Logging in as ${state.email} failed: ${login.status()}`)
    const page = await context.newPage()
    for (const path of paths.length ? paths : [state.teamPath]) {
      // The first visit to a page compiles it under `nuxt dev`, which can take a while.
      await page.goto(path, { waitUntil: 'networkidle', timeout: 120_000 })
      const file = join(outDir, `${slug(path)}-${name}.png`)
      await page.screenshot({ path: file, fullPage: true })
      console.log(file)
    }
    await context.close()
  }
} finally {
  await browser.close()
}
