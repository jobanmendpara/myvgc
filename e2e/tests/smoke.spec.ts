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
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)

  await page.getByRole('link', { name: 'Create an account' }).click()
  await page.getByLabel('Email').fill(`smoke-${Date.now()}@example.com`)
  await page.getByLabel('Password').fill('smoke-test-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/teams$/)

  await page.goto('/teams/new')
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
