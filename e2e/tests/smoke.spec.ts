import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// The 2026 World Championships winner's open team list, a real paste also used by the
// paste reader's tests.
const PASTE = readFileSync(
  new URL('../../packages/core/test/fixtures/worlds-2026-yamazaki-ots.txt', import.meta.url),
  'utf8',
)
const SPECIES = ['Floette-Eternal', 'Basculegion', 'Kingambit', 'Dragonite', 'Garchomp', 'Sneasler']

test('sign up, import a Team and see its six Pokémon', async ({ page }) => {
  // Each step waits for its page's heading before using the form: the route guard checks the
  // session before every page change, so the previous page can still be on screen.
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()

  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL(/\/signup$/)
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()
  await page.getByLabel('Email').fill(`smoke-${Date.now()}@example.com`)
  await page.getByLabel('Password').fill('smoke-test-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/teams$/)
  await expect(page.getByRole('heading', { name: 'Your Teams' })).toBeVisible()

  await page.goto('/teams/new')
  await expect(page.getByRole('heading', { name: 'Import a Team' })).toBeVisible()
  await page.getByLabel('Name', { exact: true }).fill('Smoke test Team')
  await page.getByLabel('Regulation').selectOption('M-B')
  await page.getByLabel('Paste', { exact: true }).fill(PASTE)
  await page.getByRole('button', { name: 'Save Team' }).click()

  await expect(page).toHaveURL(/\/teams\/[0-9a-f-]{36}$/)
  await expect(page.getByTestId('team-name')).toHaveText('Smoke test Team')
  const builds = page.getByTestId('pokemon-build')
  await expect(builds).toHaveCount(6)
  for (const [index, species] of SPECIES.entries()) {
    await expect(builds.nth(index).getByRole('heading', { level: 2 })).toHaveText(species)
  }

  await page.goto('/teams')
  await expect(page.getByTestId('teams-list')).toContainText('Smoke test Team')
})

test('log a Tournament and a Round against a new Opponent', async ({ page }) => {
  await page.goto('/signup')
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()
  await page.getByLabel('Email').fill(`smoke-round-${Date.now()}@example.com`)
  await page.getByLabel('Password').fill('smoke-test-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/teams$/)

  await page.getByRole('link', { name: 'Tournaments' }).click()
  await expect(page.getByRole('heading', { name: 'Your Tournaments' })).toBeVisible()
  await page.getByRole('link', { name: 'Log your first Tournament' }).click()
  await expect(page.getByRole('heading', { name: 'New Tournament' })).toBeVisible()
  await page.getByLabel('Name', { exact: true }).fill('Smoke test Regional')
  await page.getByLabel('Start date').fill('2026-09-19')
  await page.getByRole('button', { name: 'Save Tournament' }).click()
  await expect(page.getByTestId('tournament-name')).toHaveText('Smoke test Regional')

  await page.getByRole('link', { name: 'Log Round' }).click()
  await expect(page.getByRole('heading', { name: 'Log a Round' })).toBeVisible()
  await page.getByRole('combobox').fill('Smoke Opponent')
  await page.getByRole('option', { name: /Add “Smoke Opponent”/ }).click()
  await page.getByText('Win', { exact: true }).click()
  await page.getByRole('button', { name: 'Log Round' }).click()

  await expect(page.getByTestId('record')).toContainText('Swiss 1-0-0')
  await expect(page.getByTestId('round')).toContainText('Smoke Opponent')
})

test('the chosen palette and mode survive a reload, also before logging in', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
  await page.getByLabel('Palette').selectOption('lapras')
  await page.getByLabel('Mode').selectOption('dark')
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-palette', 'lapras')
  await expect(html).toHaveAttribute('data-mode', 'dark')

  await page.reload()
  await expect(html).toHaveAttribute('data-palette', 'lapras')
  await expect(html).toHaveAttribute('data-mode', 'dark')
  await expect(page.getByLabel('Palette')).toHaveValue('lapras')
  await expect(page.getByLabel('Mode')).toHaveValue('dark')
})
