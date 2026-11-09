import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

// The 2026 World Championships winner's open team list, a real paste also used by the
// paste reader's tests.
const PASTE = readFileSync(
  new URL('../../packages/core/test/fixtures/worlds-2026-yamazaki-ots.txt', import.meta.url),
  'utf8',
)
const SPECIES = ['Floette-Eternal', 'Basculegion', 'Kingambit', 'Dragonite', 'Garchomp', 'Sneasler']

// Sign-ups are rate-limited (Better Auth allows 3 every 10 seconds from one address), so each
// project signs up one User in the first test and the later tests reuse that session. The tests
// therefore run in order, and stop at the first failure.
test.describe.configure({ mode: 'serial' })
const sessionFile = (project: string) =>
  fileURLToPath(new URL(`../.auth/${project}.json`, import.meta.url))
// A fresh email per project, since the phone and desktop projects run side by side.
const email = () => `smoke-${test.info().project.name}-${Date.now()}@example.com`

test('sign up, import a Team and see its six Pokémon', async ({ page }) => {
  // Each step waits for its page's heading before using the form: the route guard checks the
  // session before every page change, so the previous page can still be on screen.
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()

  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL(/\/signup$/)
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()
  await page.getByLabel('Email').fill(email())
  await page.getByLabel('Password').fill('smoke-test-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/teams$/)
  await expect(page.getByRole('heading', { name: 'Your Teams' })).toBeVisible()
  await page.context().storageState({ path: sessionFile(test.info().project.name) })

  await page.goto('/teams/new')
  await expect(page.getByRole('heading', { name: 'New Team' })).toBeVisible()
  await page.getByRole('link', { name: /Import a paste/ }).click()
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

test.describe('as the signed-up User', () => {
  // Playwright reads a fixture's dependencies from its first argument, so it must be a pattern.
  // eslint-disable-next-line no-empty-pattern
  test.use({ storageState: async ({}, use, testInfo) => use(sessionFile(testInfo.project.name)) })

  test('build a one-Pokémon Team, then edit a move', async ({ page }) => {
    await page.goto('/teams')
    await expect(page.getByRole('heading', { name: 'Your Teams' })).toBeVisible()

    await page.goto('/teams/new')
    await page.getByRole('link', { name: /Build/ }).click()
    await expect(page.getByRole('heading', { name: 'Build a Team' })).toBeVisible()
    await page.getByLabel('Name', { exact: true }).fill('Built Team')

    const pick = async (label: string, search: string) => {
      await page.getByRole('combobox', { name: label }).fill(search)
      await page.getByRole('option', { name: search, exact: true }).click()
    }

    await page.getByRole('button', { name: 'Add a Pokémon' }).first().click()
    await pick('Species', 'Incineroar')
    await page.getByRole('combobox', { name: 'Ability' }).click()
    await expect(page.getByRole('listbox').getByRole('option')).toHaveText(['Blaze', 'Intimidate'])
    // Only a convenience: an ability that isn't the species' own can still be found and saved,
    // with a warning all the way (ADR 18).
    await pick('Ability', 'Levitate')
    const warning = "Incineroar can't have Levitate."
    await expect(page.getByTestId('build-editor')).toContainText(warning)
    await pick('Move 1', 'Fake Out')
    await pick('Move 2', 'Psychic')
    const moveWarning = "Incineroar can't learn Psychic."
    await expect(page.getByTestId('build-move-2-field')).toContainText(moveWarning)
    await expect(page.getByTestId('build-move-1-field')).not.toContainText(moveWarning)
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByTestId('build-warning')).toHaveText([warning, moveWarning])
    await expect(page.getByTestId('legality-note')).toHaveText("This Team isn't legal in M-C.")
    await page.getByRole('button', { name: 'Save Team' }).click()

    await expect(page).toHaveURL(/\/teams\/[0-9a-f-]{36}$/)
    await expect(page.getByTestId('pokemon-build')).toContainText('Fake Out')
    await expect(page.getByTestId('pokemon-build')).toContainText('Levitate')
    await expect(page.getByTestId('pokemon-build')).toContainText(warning)
    const moves = page.getByRole('list', { name: 'Moves' }).locator(':scope > li')
    await expect(moves.filter({ hasText: 'Psychic' })).toContainText(moveWarning)
    await expect(moves.filter({ hasText: 'Fake Out' })).not.toContainText(moveWarning)
    await expect(page.getByTestId('legality-badge')).toHaveText('Illegal in M-C')

    await page.getByRole('link', { name: 'Edit' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Team' })).toBeVisible()
    await page
      .getByTestId('build-slot')
      .getByRole('button', { name: /Incineroar/ })
      .click()
    await page.getByTestId('build-move-1-choice').getByRole('button', { name: 'Change' }).click()
    await pick('Move 1', 'Flare Blitz')
    await page.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('button', { name: 'Save Team' }).click()

    await expect(page).toHaveURL(/\/teams\/[0-9a-f-]{36}$/)
    await expect(page.getByTestId('pokemon-build')).toContainText('Flare Blitz')
    await expect(page.getByTestId('pokemon-build')).not.toContainText('Fake Out')

    await page.getByRole('link', { name: 'Edit' }).click()
    await page.getByLabel('Regulation').selectOption('M-A')
    await expect(page.getByTestId('legality-note')).toContainText("this Team isn't checked")
    await page.getByRole('button', { name: 'Save Team' }).click()
    await expect(page).toHaveURL(/\/teams\/[0-9a-f-]{36}$/)

    await page.goto('/teams')
    const builtTeam = page
      .getByTestId('teams-list')
      .locator(':scope > li', { hasText: 'Built Team' })
    await expect(builtTeam.getByTestId('legality-badge')).toHaveText('Not checked')
  })

  test('log a Tournament and a Round against a new Opponent', async ({ page }) => {
    await page.goto('/teams')
    await expect(page.getByRole('heading', { name: 'Your Teams' })).toBeVisible()

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
    await page.getByRole('combobox', { name: 'Opponent' }).fill('Smoke Opponent')
    await page.getByRole('option', { name: /Add “Smoke Opponent”/ }).click()
    await page.getByText('Win', { exact: true }).click()
    await page.getByTestId('games').locator('summary').click()
    await page.getByTestId('game-1').getByText('Win', { exact: true }).click()
    await page.getByRole('button', { name: 'Log Round' }).click()

    await expect(page.getByTestId('record')).toContainText('Swiss 1-0-0')
    await expect(page.getByTestId('round')).toContainText('Smoke Opponent')
    await expect(page.getByTestId('game-line')).toHaveText('Game 1 · Win')
  })
})

test('the chosen palette and mode survive a reload, also before logging in', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Palette' }).click()
  await page.getByRole('option', { name: 'Lapras' }).click()
  await page.getByRole('radiogroup', { name: 'Mode' }).getByText('Dark').click()
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-palette', 'lapras')
  await expect(html).toHaveAttribute('data-mode', 'dark')

  await page.reload()
  await expect(html).toHaveAttribute('data-palette', 'lapras')
  await expect(html).toHaveAttribute('data-mode', 'dark')
  await expect(page.getByRole('combobox', { name: 'Palette' })).toContainText('Lapras')
  await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked()
})
