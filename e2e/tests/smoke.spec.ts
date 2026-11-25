import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { expect, test } from './client'

// The 2026 World Championships winner's open team list, a real paste also used by the
// paste reader's tests.
const PASTE = readFileSync(
  new URL('../../packages/core/test/fixtures/worlds-2026-yamazaki-ots.txt', import.meta.url),
  'utf8',
)
// A Teamsheet filled in on teamsheet.gg, also used by the Teamsheet reader's tests.
const TEAMSHEET = fileURLToPath(
  new URL('../../packages/core/test/fixtures/teamsheet-gg-filled.pdf', import.meta.url),
)
const SPECIES = ['Floette-Eternal', 'Basculegion', 'Kingambit', 'Dragonite', 'Garchomp', 'Sneasler']

// A fresh email per test and project, since the phone and desktop projects run side by side.
const email = (prefix: string) => `${prefix}-${test.info().project.name}-${Date.now()}@example.com`

// Fills in the sign-up form already on screen, and waits for the Dashboard.
async function submitSignUp(page: Page, prefix: string) {
  await page.getByLabel('Email').fill(email(prefix))
  await page.getByLabel('Password').fill('smoke-test-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

async function signUp(page: Page, prefix: string) {
  await page.goto('/signup')
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()
  await submitSignUp(page, prefix)
}

// Fills in the New Tournament form already on screen, and waits for the Tournament to open.
async function submitNewTournament(page: Page, name: string) {
  await expect(page.getByRole('heading', { name: 'New Tournament' })).toBeVisible()
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Start date').fill('2026-09-19')
  await page.getByRole('button', { name: 'Save Tournament' }).click()
  await expect(page.getByTestId('tournament-name')).toHaveText(name)
}

async function createTournament(page: Page, name: string) {
  await page.goto('/tournaments/new')
  await submitNewTournament(page, name)
}

test('sign up, import a Team and see its six Pokémon', async ({ page }) => {
  // Each step waits for its page's heading before using the form: the route guard checks the
  // session before every page change, so the previous page can still be on screen.
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()

  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL(/\/signup$/)
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()
  await submitSignUp(page, 'smoke')

  // With no ANTHROPIC_API_KEY, reading images is off and its upload is hidden (ADR 24).
  const reading = page.waitForResponse((res) => res.url().endsWith('/api/teams/read'))
  await page.goto('/teams/new')
  await expect(page.getByRole('heading', { name: 'New Team' })).toBeVisible()
  expect(await (await reading).json()).toEqual({ images: false })
  await expect(page.getByRole('link', { name: /Read a Teamsheet/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Read screenshots/ })).toHaveCount(0)
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

  // Each build card shows its Sprite, a committed file served from the app's own origin (ADR 29).
  const sprite = builds.nth(2).getByTestId('sprite')
  await sprite.scrollIntoViewIfNeeded()
  await expect(sprite).toHaveAttribute('src', '/sprites/kingambit.webp')
  await expect
    .poll(() => sprite.evaluate((img: HTMLImageElement) => (img.complete ? img.naturalWidth : 0)))
    .toBeGreaterThan(0)

  // Its held item's Item icon, its Type icons, and each move's Type icon and power/accuracy
  // (DEV-224). Kowtow Cleave never misses and Low Kick's power varies.
  await expect(builds.nth(2).getByTestId('item-icon')).toHaveAttribute(
    'src',
    '/item-icons/chopleberry.webp',
  )
  const types = builds.nth(2).getByTestId('build-types').getByRole('img')
  await expect(types).toHaveCount(2)
  await expect(types.nth(0)).toHaveAccessibleName('Dark')
  await expect(types.nth(1)).toHaveAccessibleName('Steel')
  const kingambitMoves = builds.nth(2).getByRole('list', { name: 'Moves' }).locator(':scope > li')
  await expect(kingambitMoves.filter({ hasText: 'Kowtow Cleave' })).toContainText('85/—')
  await expect(kingambitMoves.filter({ hasText: 'Low Kick' })).toContainText('—/100')
  await expect(
    kingambitMoves.filter({ hasText: 'Kowtow Cleave' }).getByRole('img', { name: 'Dark' }),
  ).toBeVisible()

  // Each page's Sprite style is a Device setting picked from the header, Inline until then
  // (DEV-180). It applies at once and stays on the device.
  await expect(sprite).toHaveAttribute('width', '32')
  const styleButton = page.getByRole('button', { name: 'Sprite style' })
  await styleButton.click()
  const styleDialog = page.getByRole('dialog', { name: 'Sprites on Teams' })
  await styleDialog.getByText('Stacked tiles').click()
  await expect(styleDialog).toBeHidden()
  await expect(sprite).toHaveAttribute('width', '48')
  await expect(styleButton).toHaveAttribute('title', 'Sprite style: Stacked tiles')
  await page.reload()
  await expect(sprite).toHaveAttribute('width', '48')

  // Teamsheet export needs the bundled team list and font in the image (ADR 18, ADR 25).
  await page.getByTestId('export-teamsheet').click()
  await expect(page.getByRole('alertdialog', { name: 'Export Teamsheet' })).toBeVisible()
  await expect(page.getByLabel('Battle Team Number / Name')).toHaveValue('Smoke test Team')
  await page.getByLabel('Player Name').fill('Smoke Tester')
  const download = page.waitForEvent('download')
  await page.getByTestId('export-teamsheet-submit').click()
  expect((await download).suggestedFilename()).toBe('Smoke test Team Teamsheet.pdf')
  await expect(page.getByRole('alertdialog')).toBeHidden()

  // On wide screens the list stays beside the new Team, with its row selected.
  const wide = test.info().project.name === 'desktop'
  const row = page.getByTestId('teams-list').getByRole('link', { name: /Smoke test Team/ })
  if (wide) {
    await expect(row).toBeVisible()
    await expect(row).toHaveAttribute('aria-current', 'page')
  }

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Teams' }).click()
  await expect(page.getByTestId('teams-list')).toContainText('Smoke test Team')
  if (wide) {
    await expect(page.getByText('Select a Team')).toBeVisible()
    await expect(row).not.toHaveAttribute('aria-current')
  }
})

test('build a one-Pokémon Team, then edit a move', async ({ page }) => {
  await signUp(page, 'smoke-build')

  // Cancel goes back to the New Team chooser, or on wide screens to the empty pane.
  const wide = test.info().project.name === 'desktop'
  await page.goto('/teams/new')
  await page.getByRole('link', { name: /Build/ }).click()
  await expect(page.getByRole('heading', { name: 'Build a Team' })).toBeVisible()
  await page.getByRole('link', { name: 'Cancel' }).click()
  if (wide) await expect(page.getByText('Select a Team')).toBeVisible()
  else await expect(page.getByRole('heading', { name: 'New Team' })).toBeVisible()

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
  // The Team's own badge; on wide screens its list row shows one too.
  await expect(page.getByTestId('team-header').getByTestId('legality-badge')).toHaveText(
    'Illegal in M-C',
  )

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
  await expect(page.getByTestId('legality-badge')).toHaveText('Not checked')

  // Deleting the open Team goes back to the list, or on wide screens to the empty pane.
  await page
    .getByTestId('teams-list')
    .getByRole('link', { name: /Built Team/ })
    .click()
  await expect(page.getByTestId('team-name')).toHaveText('Built Team')
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete Team' }).click()
  await expect(page.getByTestId('teams-empty')).toBeVisible()
  if (wide) await expect(page.getByText('Select a Team')).toBeVisible()
})

test('log a Tournament and a Round against a new Opponent', async ({ page }) => {
  await signUp(page, 'smoke-round')

  await page.getByRole('link', { name: 'Tournaments' }).click()
  await expect(page.getByRole('heading', { name: 'Your Tournaments' })).toBeVisible()
  await page.getByRole('link', { name: 'Log your first Tournament' }).click()
  await submitNewTournament(page, 'Smoke test Regional')

  // On wide screens the list stays beside the open Tournament, with its row selected.
  const wide = test.info().project.name === 'desktop'
  const row = page
    .getByTestId('tournaments-list')
    .getByRole('link', { name: /Smoke test Regional/ })
  if (wide) {
    await expect(row).toBeVisible()
    await expect(row).toHaveAttribute('aria-current', 'page')
  }

  await page.getByRole('link', { name: 'Log Round' }).click()
  await expect(page.getByRole('heading', { name: 'Log a Round' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Opponent' }).fill('Smoke Opponent')
  await page.getByRole('option', { name: /Add “Smoke Opponent”/ }).click()
  // Reading their open teamsheet fills in their Team for review (ADR 24); pdf-lib and the
  // Champions data must be in the image.
  const theirTeam = page.getByTestId('their-team-section')
  await theirTeam.locator('summary').click()
  await theirTeam.getByTestId('their-teamsheet-file').setInputFiles(TEAMSHEET)
  await expect(theirTeam.getByTestId('their-team').locator(':scope > li')).toHaveCount(6)
  await expect(theirTeam.getByTestId('their-pokemon-0')).toContainText('Charizard')
  await page.getByText('Win', { exact: true }).click()
  await page.getByTestId('games').locator('summary').click()
  await page.getByTestId('game-1').getByText('Win', { exact: true }).click()
  // On wide screens only the pane scrolls: picking a choice never scrolls the page past the
  // form into blank space (DEV-165).
  if (wide) expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await page.getByRole('button', { name: 'Log Round' }).click()

  await expect(page.getByTestId('record')).toContainText('Swiss 1-0-0')
  await expect(page.getByTestId('round')).toContainText('Smoke Opponent')
  await expect(page.getByTestId('game-line')).toHaveText('Game 1 · Win')

  if (wide) {
    await expect(row).toHaveAttribute('aria-current', 'page')
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Tournaments' })
      .click()
    await expect(page.getByText('Select a Tournament')).toBeVisible()
    await expect(row).toBeVisible()
    await expect(row).not.toHaveAttribute('aria-current')

    await row.click()
    await expect(page.getByTestId('tournament-name')).toHaveText('Smoke test Regional')
    await expect(row).toBeVisible()

    // Clicking a row in the middle of a form asks before discarding the edits.
    await page.getByRole('link', { name: 'Edit details' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Tournament' })).toBeVisible()
    await page.getByLabel('Name', { exact: true }).fill('Renamed Regional')
    await row.click()
    const discard = page.getByRole('alertdialog', { name: 'Discard changes?' })
    await discard.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Renamed Regional')
    await row.click()
    await discard.getByRole('button', { name: 'Discard changes' }).click()
    await expect(page.getByTestId('tournament-name')).toHaveText('Smoke test Regional')
  }

  // The new Opponent is in the Opponents list, with the Round against them.
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Opponents' })
    .click()
  const opponentRow = page
    .getByTestId('opponents-list')
    .getByRole('link', { name: /Smoke Opponent/ })
  // Opponents start in the Compact List style: the name and the Head-to-head record.
  await expect(opponentRow).toContainText('1-0-0')
  if (wide) await expect(page.getByText('Select an Opponent')).toBeVisible()
  await opponentRow.click()
  await expect(page.getByTestId('opponent-name')).toHaveText('Smoke Opponent')
  // Their Team was saved with the Round, keeping only what an open teamsheet shows.
  const savedTeam = page.getByRole('list', { name: "Opponent's Team" })
  await expect(savedTeam.locator(':scope > li')).toHaveCount(6)
  await expect(savedTeam).toContainText('Charizard @ Charizardite Y')

  if (wide) {
    await expect(opponentRow).toHaveAttribute('aria-current', 'page')

    // Adding an Opponent lands on them, selected.
    await page.getByRole('button', { name: 'Add Opponent' }).click()
    await page.getByLabel('Name', { exact: true }).fill('Second Opponent')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByTestId('opponent-name')).toHaveText('Second Opponent')
    const secondRow = page
      .getByTestId('opponents-list')
      .getByRole('link', { name: /Second Opponent/ })
    await expect(secondRow).toHaveAttribute('aria-current', 'page')

    // Clicking another row in the middle of an edit asks before discarding it.
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByLabel('Display name').fill('Renamed Opponent')
    await opponentRow.click()
    const discard = page.getByRole('alertdialog', { name: 'Discard changes?' })
    await discard.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page.getByLabel('Display name')).toHaveValue('Renamed Opponent')
    await opponentRow.click()
    await discard.getByRole('button', { name: 'Discard changes' }).click()
    await expect(page.getByTestId('opponent-name')).toHaveText('Smoke Opponent')
    await expect(opponentRow).toHaveAttribute('aria-current', 'page')

    // Merging a duplicate keeps the survivor open and selected, and drops the duplicate's row.
    await page.getByRole('button', { name: 'Merge another Opponent into this one…' }).click()
    const merge = page.getByRole('alertdialog', { name: 'Merge into Smoke Opponent' })
    await merge.getByRole('combobox', { name: 'Duplicate' }).fill('Second')
    await merge.getByRole('option', { name: 'Second Opponent', exact: true }).click()
    await expect(merge.getByTestId('merge-summary')).toContainText('Second Opponent')
    await merge.getByRole('button', { name: 'Merge', exact: true }).click()
    await expect(merge).toBeHidden()
    await expect(page.getByRole('status')).toHaveText('Merged Second Opponent into Smoke Opponent.')
    await expect(page.getByTestId('opponent-name')).toHaveText('Smoke Opponent')
    await expect(page.getByText('Also: Second Opponent')).toBeVisible()
    await expect(opponentRow).toHaveAttribute('aria-current', 'page')
    await expect(secondRow).toHaveCount(0)
  }

  // Deleting the open Opponent goes back to the list, or on wide screens to the empty pane.
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Opponents' })
    .click()
  await page.getByRole('button', { name: 'Add Opponent' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Short-lived Opponent')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByTestId('opponent-name')).toHaveText('Short-lived Opponent')
  await page.getByRole('button', { name: 'Delete Opponent' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete Opponent' }).click()
  await expect(page.getByTestId('opponents-list')).toContainText('Smoke Opponent')
  await expect(page.getByTestId('opponents-list')).not.toContainText('Short-lived Opponent')
  if (wide) await expect(page.getByText('Select an Opponent')).toBeVisible()
})

test('see a Statistic, and the Rounds and Games behind it', async ({ page }) => {
  await signUp(page, 'smoke-statistics')
  await createTournament(page, 'Statistics Regional')

  // A best-of-3 Round won 2-1, the Opponent Bringing Incineroar every Game. Picked for their side
  // in Game 1, it joins their Team (ADR 22) and is offered in the next Games.
  await page.getByRole('link', { name: 'Log Round' }).click()
  await expect(page.getByRole('heading', { name: 'Log a Round' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Opponent' }).fill('Statistics Opponent')
  await page.getByRole('option', { name: /Add “Statistics Opponent”/ }).click()
  await page.getByRole('group', { name: 'Best of' }).getByText('Best of 3').click()
  await page
    .getByRole('group', { name: 'Game score (yours first)' })
    .getByText('2-1', { exact: true })
    .click()
  await page.getByTestId('games').locator('summary').click()
  const theirSide = (game: number) =>
    page.getByTestId(`game-${game}`).getByRole('group', { name: /^Opponent/ })
  await theirSide(1).getByRole('combobox', { name: 'Other species…' }).fill('Incineroar')
  await theirSide(1).getByRole('option', { name: 'Incineroar', exact: true }).click()
  for (const [game, result] of [
    [1, 'Win'],
    [2, 'Loss'],
    [3, 'Win'],
  ] as const) {
    if (game > 1)
      await theirSide(game)
        .getByRole('button', { name: /^Incineroar/ })
        .click()
    await page.getByTestId(`game-${game}`).getByText(result, { exact: true }).click()
  }
  await page.getByRole('button', { name: 'Log Round' }).click()
  await expect(page.getByTestId('round')).toContainText('Statistics Opponent')

  // The page shows the Regulation in force today by default; the Tournament's, from its start
  // date, may be another, so show every Regulation.
  await page.goto('/statistics?regulation=all')
  await expect(page.getByRole('heading', { name: 'Statistics', exact: true })).toBeVisible()

  // Species faced counts Rounds: Incineroar was on their Team in one Round, won 2-1.
  const faced = page.getByRole('region', { name: 'Species faced' })
  const facedRow = faced.getByRole('row').filter({ hasText: 'Incineroar' })
  await expect(facedRow.getByRole('cell')).toHaveText([/Incineroar/, '1', '1-0-0', '100%'])
  await facedRow.getByRole('button', { name: 'Incineroar' }).click()
  const round = faced.getByRole('link')
  await expect(round).toHaveCount(1)
  await expect(round).toContainText('Statistics Regional, Round 1')
  await expect(round).toContainText('vs Statistics Opponent')
  await expect(round).toContainText('Win 2-1')

  // Their Brought Pokémon count Games: Incineroar in all three, won two.
  const brought = page.getByRole('region', { name: 'Opponent’s Brought Pokémon' })
  await expect(brought).toContainText('Based on all 3 Games')
  const broughtRow = brought.getByRole('row').filter({ hasText: 'Incineroar' })
  await expect(broughtRow.getByRole('cell')).toHaveText([/Incineroar/, '3', '2-1-0', '67%'])
  await broughtRow.getByRole('button', { name: 'Incineroar' }).click()
  const games = brought.getByRole('link')
  await expect(games).toHaveCount(3)
  for (const [index, result] of ['Win', 'Loss', 'Win'].entries()) {
    await expect(games.nth(index)).toContainText(`Statistics Regional, Round 1, Game ${index + 1}`)
    await expect(games.nth(index)).toContainText(result)
  }

  // Each one links to its Round.
  await games.nth(1).click()
  await expect(page).toHaveURL(/\/tournaments\/[0-9a-f-]{36}\/rounds\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: 'Edit Round' })).toBeVisible()
  await expect(page.getByTestId('game-2').getByRole('radio', { name: 'Loss' })).toBeChecked()
})

test('upload a Teamsheet PDF to a Tournament, then read it into a Team', async ({ page }) => {
  await signUp(page, 'smoke-teamsheet')
  await createTournament(page, 'Teamsheet Regional')

  // The attachment is stored on the server (ADR 27); reading it doesn't send the file again.
  await page
    .getByTestId('teamsheet-upload')
    .setInputFiles(
      new URL('../../packages/core/test/fixtures/teamsheet-gg-filled.pdf', import.meta.url)
        .pathname,
    )
  await expect(page.getByTestId('teamsheet-file-name')).toHaveText('teamsheet-gg-filled.pdf')
  await page.getByRole('link', { name: 'Read into a Team' }).click()
  await expect(page.getByRole('heading', { name: 'Read a Teamsheet' })).toBeVisible()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('9TCG84KWXK')
  await expect(page.getByTestId('build-slot')).toHaveCount(6)
  await page.getByRole('button', { name: 'Save Team' }).click()

  await expect(page).toHaveURL(/\/teams\/[0-9a-f-]{36}$/)
  await expect(page.getByTestId('team-name')).toHaveText('9TCG84KWXK')
  await expect(page.getByTestId('pokemon-build')).toHaveCount(6)
  await expect(
    page.getByTestId('pokemon-build').first().getByRole('heading', { level: 2 }),
  ).toHaveText('Charizard')
})

test('the chosen List style survives a reload, and changes with no signal too', async ({
  page,
}) => {
  await signUp(page, 'smoke-list-style')

  await page.goto('/opponents')
  await page.getByRole('button', { name: 'Add Opponent' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Ash Ketchum')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByTestId('opponent-name')).toHaveText('Ash Ketchum')

  await page.goto('/opponents')
  const listStyle = page.getByRole('radiogroup', { name: 'List style' })
  const list = page.getByTestId('opponents-list')
  await expect(listStyle.getByRole('radio', { name: 'Compact' })).toBeChecked()
  await expect(list.getByRole('heading')).toHaveCount(0)

  const saved = page.waitForResponse(
    (res) => res.url().endsWith('/api/account/list-styles') && res.request().method() === 'PUT',
  )
  await listStyle.getByTitle('Grouped').click()
  expect((await saved).ok()).toBe(true)
  await expect(list.getByRole('heading', { name: 'A' })).toBeVisible()

  await page.reload()
  await expect(listStyle.getByRole('radio', { name: 'Grouped' })).toBeChecked()
  await expect(list.getByRole('heading', { name: 'A' })).toBeVisible()
  await expect(list).toContainText('Ash Ketchum')

  // Search tolerates a typo, and the Grouped headings drop away while searching.
  const search = page.getByRole('searchbox', { name: 'Search Opponents' })
  await search.fill('Ash Kecthum')
  await expect(list).toContainText('Ash Ketchum')
  await expect(list.getByRole('heading')).toHaveCount(0)
  await search.fill('Misty')
  await expect(page.getByText('No Opponents match “Misty”.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(search).toHaveValue('')
  await expect(list.getByRole('heading', { name: 'A' })).toBeVisible()

  // Offline, the List style still changes at once, and is sent when the signal returns (DEV-205).
  await page.context().setOffline(true)
  await listStyle.getByTitle('Compact').click()
  await expect(listStyle.getByRole('radio', { name: 'Compact' })).toBeChecked()
  await expect(list.getByRole('heading')).toHaveCount(0)
  await expect(page.getByTestId('sync-bar')).toContainText('1 change saved on this phone')
  await page.context().setOffline(false)
  await expect(page.getByTestId('sync-bar')).toContainText('1 change sent')
  await page.reload()
  await expect(listStyle.getByRole('radio', { name: 'Compact' })).toBeChecked()
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

test('a page visited before opens with no signal, and the API never comes from the device', async ({
  context,
  page,
}) => {
  const session = page.waitForResponse((res) => res.url().includes('/api/auth/get-session'))
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
  expect((await session).fromServiceWorker()).toBe(false)
  // The service worker has kept the app's files on the device.
  await page.evaluate(() => navigator.serviceWorker.ready)
  const manifest = await page.request.get('/manifest.webmanifest')
  expect(await manifest.json()).toMatchObject({ name: 'MyVGC', display: 'standalone' })
  await page.close()

  // A cold start with no signal: a new page, as when the app is opened from the home screen.
  await context.setOffline(true)
  const offline = await context.newPage()
  const res = await offline.goto('/tournaments')
  expect(res?.status()).toBe(200)
  expect(res?.fromServiceWorker()).toBe(true)
  await expect(offline.getByText('MyVGC', { exact: true }).first()).toBeVisible()
  // Every Sprite is kept on the device, also one no page has shown yet.
  const sprite = await offline.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const img = new Image()
        img.onload = () => resolve(img.naturalWidth)
        img.onerror = () => resolve(0)
        img.src = '/sprites/garchomp.webp'
      }),
  )
  expect(sprite).toBeGreaterThan(0)
  // With no signal the API can't be reached: the service worker never answers for it.
  const api = await offline.evaluate(() =>
    fetch('/api/health').then(
      () => 'answered',
      () => 'unreachable',
    ),
  )
  expect(api).toBe('unreachable')
  await context.setOffline(false)
})

test('with no signal, the app opens as the last known User with their cached pages', async ({
  context,
  page,
}) => {
  await signUp(page, 'smoke-offline')
  const user = (await page.getByTestId('current-user').textContent())?.trim()
  await createTournament(page, 'Offline Open')
  await page.goto('/tournaments')
  await expect(page.getByText('Offline Open').first()).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)
  // The query cache is saved on the device a moment after it changes.
  const savedCaches = () =>
    page.evaluate(
      () =>
        new Promise<number>((resolve, reject) => {
          const open = indexedDB.open('myvgc')
          open.onerror = () => reject(open.error)
          open.onsuccess = () => {
            const count = open.result.transaction('query-cache').objectStore('query-cache').count()
            count.onsuccess = () => {
              open.result.close()
              resolve(count.result)
            }
          }
        }),
    )
  await expect.poll(savedCaches).toBe(1)
  await page.close()

  // A cold start with no signal: the session check can't reach the server.
  await context.setOffline(true)
  const offline = await context.newPage()
  await offline.goto('/tournaments')
  await expect(offline.getByTestId('current-user')).toHaveText(user ?? '')
  await expect(offline.getByText('Offline Open').first()).toBeVisible()
  await expect(offline.getByText("Can't reach the server")).toHaveCount(0)
  await context.setOffline(false)
})

// The query keys in the User's query cache saved on the device.
const savedQueryKeys = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('myvgc')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const all = open.result.transaction('query-cache').objectStore('query-cache').getAll()
          all.onsuccess = () => {
            open.result.close()
            const caches = all.result as { clientState: { queries: { queryHash: string }[] } }[]
            resolve(caches.flatMap((cache) => cache.clientState.queries.map((q) => q.queryHash)))
          }
        }
      }),
  )

test('a cold start with no signal shows the saved Tournaments and Opponents, also after a reload', async ({
  context,
  page,
}) => {
  await signUp(page, 'smoke-cold')
  await createTournament(page, 'Cold Open')
  await page.getByRole('link', { name: 'Log Round' }).click()
  await page.getByRole('combobox', { name: 'Opponent' }).fill('Cold Rival')
  await page.getByRole('option', { name: /Add “Cold Rival”/ }).click()
  await page.getByText('Win', { exact: true }).click()
  await page.getByRole('button', { name: 'Log Round' }).click()
  await expect(page.getByTestId('round')).toContainText('Cold Rival')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await nav.getByRole('link', { name: 'Tournaments' }).click()
  await expect(page.getByText('Cold Open').first()).toBeVisible()
  await nav.getByRole('link', { name: 'Opponents' }).click()
  await expect(page.getByTestId('opponents-list')).toContainText('Cold Rival')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect
    .poll(() => savedQueryKeys(page))
    .toEqual(expect.arrayContaining(['["tournaments"]', '["opponents","list"]']))
  await page.close()

  // Offline before the app opens, as when it is launched in Airplane mode (DEV-209). Each list
  // must still show once a fetch would have failed and been retried, which takes over a second.
  await context.setOffline(true)
  const offline = await context.newPage()
  const failed = offline.getByText(/Couldn't load your/)
  await offline.goto('/tournaments')
  await expect(offline.getByText('Cold Open').first()).toBeVisible()
  await offline.waitForTimeout(3000)
  await expect(offline.getByText('Cold Open').first()).toBeVisible()
  await expect(failed).toHaveCount(0)

  await offline
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Opponents' })
    .click()
  await expect(offline.getByTestId('opponents-list')).toContainText('Cold Rival')
  await offline.waitForTimeout(3000)
  await expect(offline.getByTestId('opponents-list')).toContainText('Cold Rival')
  await expect(failed).toHaveCount(0)

  // Nothing was forgotten: a reload with no signal still shows both lists.
  await offline.reload()
  await expect(offline.getByTestId('opponents-list')).toContainText('Cold Rival')
  await offline.goto('/tournaments')
  await expect(offline.getByText('Cold Open').first()).toBeVisible()
  await expect(failed).toHaveCount(0)
  await context.setOffline(false)
})

test('when the server can’t be reached on a connected phone, the saved lists stay and are kept', async ({
  context,
  page,
}) => {
  await signUp(page, 'smoke-venue')
  await createTournament(page, 'Venue Open')
  await page.goto('/tournaments')
  await expect(page.getByText('Venue Open').first()).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => savedQueryKeys(page)).toContain('["tournaments"]')
  await page.close()

  // Venue Wi-Fi with no internet: the phone says it is online, but every API request fails, so
  // the Tournaments list refetches and fails (DEV-209).
  await context.route('**/api/**', (route) => route.abort('internetdisconnected'))
  const venue = await context.newPage()
  await venue.goto('/tournaments')
  await expect(venue.getByText('Venue Open').first()).toBeVisible()
  await venue.waitForTimeout(3000)
  await expect(venue.getByText('Venue Open').first()).toBeVisible()
  await expect(venue.getByText(/Couldn't load your/)).toHaveCount(0)

  // The failed refetch didn't drop the list from the device: it shows again after a reload.
  await venue.waitForTimeout(1500)
  await venue.reload()
  await expect(venue.getByText('Venue Open').first()).toBeVisible()
  await context.unroute('**/api/**')
})

test('a Round logged with no signal is kept on the phone and sent when the signal returns', async ({
  context,
  page,
}) => {
  await signUp(page, 'smoke-outbox')
  await createTournament(page, 'Outbox Open')
  // Opened once with a signal, so the Round form has what it needs offline.
  await page.getByRole('link', { name: 'Log Round' }).click()
  await expect(page.getByRole('heading', { name: 'Log a Round' })).toBeVisible()
  await page.goBack()
  await expect(page.getByTestId('tournament-name')).toHaveText('Outbox Open')

  await context.setOffline(true)
  await page.getByRole('link', { name: 'Log Round' }).click()
  await expect(page.getByRole('heading', { name: 'Log a Round' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Opponent' }).fill('Offline Opponent')
  await page.getByRole('option', { name: /Add “Offline Opponent”/ }).click()
  await page.getByText('Win', { exact: true }).click()
  await page.getByRole('button', { name: 'Log Round' }).click()

  // Shown at once, with the Record, while it waits on the phone.
  await expect(page.getByTestId('record')).toContainText('Swiss 1-0-0')
  await expect(page.getByTestId('round')).toContainText('Offline Opponent')
  // The bar at the bottom counts it, and the Round is marked until the server has it.
  await expect(page.getByTestId('offline')).toBeVisible()
  await expect(page.getByTestId('sync-bar')).toContainText('1 change saved on this phone')
  await expect(page.getByTestId('sync-bar')).toContainText('Sent when the signal returns')
  await expect(page.getByTestId('round').getByTestId('sync-mark')).toHaveText('Not synced')

  // Back online, it is sent, the bar says so for a moment, and the server has it.
  await context.setOffline(false)
  await expect(page.getByTestId('sync-bar')).toContainText('1 change sent')
  await expect(page.getByTestId('sync-mark')).toHaveCount(0)
  await expect(page.getByTestId('sync-bar')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('record')).toContainText('Swiss 1-0-0')
  await expect(page.getByTestId('round')).toContainText('Offline Opponent')
})

test('with no signal, the Round form suggests Opponents from the cached list', async ({
  context,
  page,
}) => {
  await signUp(page, 'smoke-picker')
  await createTournament(page, 'Picker Open')
  await page.getByRole('link', { name: 'Log Round' }).click()
  await page.getByRole('combobox', { name: 'Opponent' }).fill('Cached Rival')
  await page.getByRole('option', { name: /Add “Cached Rival”/ }).click()
  await page.getByText('Win', { exact: true }).click()
  await page.getByRole('button', { name: 'Log Round' }).click()
  await expect(page.getByTestId('round')).toContainText('Cached Rival')
  // Opening the Opponents list caches it on the device.
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Opponents' })
    .click()
  await expect(page.getByTestId('opponents-list')).toContainText('Cached Rival')
  await page.goBack()
  await expect(page.getByTestId('tournament-name')).toHaveText('Picker Open')

  // Offline, navigator.onLine is false: the picker still searches, and finds them (DEV-201).
  await context.setOffline(true)
  await page.getByRole('link', { name: 'Log Round' }).click()
  await expect(page.getByRole('heading', { name: 'Log a Round' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Opponent' }).fill('Cached')
  await expect(page.getByRole('option', { name: 'Cached Rival', exact: true })).toBeVisible()
  await context.setOffline(false)
})

test('a Tournament created with no signal, and a Round logged in it, are sent when the signal returns', async ({
  context,
  page,
}) => {
  await signUp(page, 'smoke-outbox-tournament')
  // Opened once with a signal, so the forms have what they need offline.
  await createTournament(page, 'Online Open')
  await page.getByRole('link', { name: 'Log Round' }).click()
  await expect(page.getByRole('heading', { name: 'Log a Round' })).toBeVisible()
  // In the app, not by reloading: the cache reaches the device a moment after it loads.
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Tournaments' })
    .click()
  await expect(page.getByRole('heading', { name: 'Your Tournaments' })).toBeVisible()

  await context.setOffline(true)
  await page.getByRole('link', { name: /^New( Tournament)?$/ }).click()
  await submitNewTournament(page, 'Venue Open')

  // Its page opens at once, marked until the server has it, and a Round can be logged in it.
  await expect(page.getByTestId('sync-mark').first()).toHaveText('Not synced')
  await page.getByRole('link', { name: 'Log Round' }).click()
  await expect(page.getByRole('heading', { name: 'Log a Round' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Opponent' }).fill('Venue Opponent')
  await page.getByRole('option', { name: /Add “Venue Opponent”/ }).click()
  await page.getByText('Win', { exact: true }).click()
  await page.getByRole('button', { name: 'Log Round' }).click()
  await expect(page.getByTestId('record')).toContainText('Swiss 1-0-0')
  await expect(page.getByTestId('round').getByTestId('sync-mark')).toHaveText('Not synced')
  await expect(page.getByTestId('sync-bar')).toContainText('2 changes saved on this phone')

  // The Tournaments list shows it, marked Not synced.
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Tournaments' })
    .click()
  const row = page.getByTestId('tournaments-list').getByRole('link', { name: /Venue Open/ })
  await expect(row.getByTestId('sync-mark')).toHaveText('Not synced')

  // Back online, the Tournament is sent first, then the Round waiting on it.
  await context.setOffline(false)
  await expect(page.getByTestId('sync-bar')).toContainText('All 2 changes sent')
  await expect(row.getByTestId('sync-mark')).toHaveCount(0)
  await page.reload()
  await row.click()
  await expect(page.getByTestId('tournament-name')).toHaveText('Venue Open')
  await expect(page.getByTestId('record')).toContainText('Swiss 1-0-0')
  await expect(page.getByTestId('round')).toContainText('Venue Opponent')
  await expect(page.getByTestId('sync-mark')).toHaveCount(0)
})

test('a Tournament created and deleted with no signal is never sent', async ({ context, page }) => {
  await signUp(page, 'smoke-outbox-unsent')
  // Opened once with a signal, so the form is on the phone.
  await page.goto('/tournaments/new')
  await expect(page.getByRole('heading', { name: 'New Tournament' })).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Tournaments' })
    .click()
  await expect(page.getByRole('heading', { name: 'Your Tournaments' })).toBeVisible()

  await context.setOffline(true)
  await page.getByRole('link', { name: 'Log your first Tournament' }).click()
  await submitNewTournament(page, 'Never Sent Open')
  await expect(page.getByTestId('sync-bar')).toContainText('1 change saved on this phone')

  // Deleting it takes it off the phone: nothing is left to send.
  await page.getByRole('button', { name: 'Delete Tournament' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete Tournament' }).click()
  await expect(page.getByTestId('tournaments-empty')).toBeVisible()
  await expect(page.getByTestId('sync-bar')).toHaveCount(0)

  const sent: string[] = []
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.url().includes('/api/tournaments'))
      sent.push(request.url())
  })
  await context.setOffline(false)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your Tournaments' })).toBeVisible()
  await expect(page.getByTestId('tournaments-empty')).toBeVisible()
  expect(sent).toEqual([])
})

test('an Opponent changed and another deleted with no signal are sent when the signal returns', async ({
  context,
  page,
}) => {
  await signUp(page, 'smoke-outbox-opponent')
  const addOpponent = async (name: string) => {
    await page.goto('/opponents')
    await page.getByRole('button', { name: 'Add Opponent' }).click()
    await page.getByLabel('Name', { exact: true }).fill(name)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByTestId('opponent-name')).toHaveText(name)
  }
  await addOpponent('Delete Me')
  await addOpponent('Rename Me')
  const nav = page.getByRole('navigation', { name: 'Main' })
  const list = page.getByTestId('opponents-list')
  // Each page opened once with a signal, in the app rather than by reloading, so it is on the
  // phone.
  await nav.getByRole('link', { name: 'Opponents' }).click()
  await list.getByRole('link', { name: /Delete Me/ }).click()
  await expect(page.getByTestId('opponent-name')).toHaveText('Delete Me')
  await nav.getByRole('link', { name: 'Opponents' }).click()
  await list.getByRole('link', { name: /Rename Me/ }).click()
  await expect(page.getByTestId('opponent-name')).toHaveText('Rename Me')

  await context.setOffline(true)
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Display name').fill('Renamed Rival')
  await page.getByRole('button', { name: 'Save' }).click()
  // Shown at once, marked until the server has it.
  await expect(page.getByTestId('opponent-name')).toHaveText('Renamed Rival')
  await expect(page.locator('header').getByTestId('sync-mark')).toHaveText('Not synced')

  await nav.getByRole('link', { name: 'Opponents' }).click()
  const renamed = list.getByRole('link', { name: /Renamed Rival/ })
  await expect(renamed.getByTestId('sync-mark')).toHaveText('Not synced')
  await list.getByRole('link', { name: /Delete Me/ }).click()
  await expect(page.getByTestId('opponent-name')).toHaveText('Delete Me')
  await page.getByRole('button', { name: 'Delete Opponent' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete Opponent' }).click()

  // Still in the list, struck through, until the server has it.
  const deleting = list.getByRole('link', { name: /Delete Me/ })
  await expect(deleting.getByTestId('sync-mark')).toHaveText('Deleting when the signal returns')
  await expect(page.getByTestId('sync-bar')).toContainText('2 changes saved on this phone')

  await context.setOffline(false)
  await expect(page.getByTestId('sync-bar')).toContainText('All 2 changes sent')
  await expect(list.getByRole('link', { name: /Delete Me/ })).toHaveCount(0)
  await page.reload()
  await expect(list).toContainText('Renamed Rival')
  await expect(list).not.toContainText('Delete Me')
  await expect(page.getByTestId('sync-mark')).toHaveCount(0)
})

// In the Team builder already on screen: names the Team and adds one Pokémon.
async function startTeam(page: Page, name: string, species: string) {
  await expect(page.getByRole('heading', { name: 'Build a Team' })).toBeVisible()
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Add a Pokémon' }).first().click()
  await page.getByRole('combobox', { name: 'Species' }).fill(species)
  await page.getByRole('option', { name: species, exact: true }).click()
  await page.getByRole('button', { name: 'Done' }).click()
}

async function saveTeam(page: Page, name: string) {
  await page.getByRole('button', { name: 'Save Team' }).click()
  await expect(page).toHaveURL(/\/teams\/[0-9a-f-]{36}$/)
  await expect(page.getByTestId('team-name')).toHaveText(name)
}

test('a Team built with no signal, and a Tournament set to it, are sent when the signal returns', async ({
  context,
  page,
}) => {
  await signUp(page, 'smoke-outbox-team')
  await createTournament(page, 'Team Open')
  const nav = page.getByRole('navigation', { name: 'Main' })
  // Built once with a signal, in the app rather than by reloading, so the Team builder and the
  // names for its pickers are on the phone.
  await nav.getByRole('link', { name: 'Teams' }).click()
  await page.getByRole('link', { name: 'Add your first Team' }).click()
  await page.getByRole('link', { name: /Build/ }).click()
  await startTeam(page, 'Online Team', 'Garchomp')
  await saveTeam(page, 'Online Team')
  await nav.getByRole('link', { name: 'Teams' }).click()
  await expect(page.getByRole('heading', { name: 'Your Teams' })).toBeVisible()

  await context.setOffline(true)
  await page.getByRole('link', { name: /^New( Team)?$/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'No signal' })).toContainText(
    'You can still build a Team',
  )
  await page.getByRole('link', { name: /Build/ }).click()
  await startTeam(page, 'Venue Team', 'Incineroar')
  // In place of the live check, which needs the server.
  await expect(page.getByTestId('legality-note')).toHaveText(
    'No signal. This Team will be checked when it syncs.',
  )
  await saveTeam(page, 'Venue Team')
  // Its page opens at once, marked until the server has it.
  await expect(page.getByTestId('checked-on-sync')).toBeVisible()
  await expect(page.getByTestId('team-pokemon')).toContainText('Incineroar')
  const row = page.getByTestId('teams-list').getByRole('link', { name: /Venue Team/ })
  await nav.getByRole('link', { name: 'Teams' }).click()
  await expect(row.getByTestId('sync-mark')).toHaveText('Not synced')

  // It can be set as a Tournament's Team, which waits for it.
  await nav.getByRole('link', { name: 'Tournaments' }).click()
  await page
    .getByTestId('tournaments-list')
    .getByRole('link', { name: /Team Open/ })
    .click()
  await page.getByRole('button', { name: 'Link a Team' }).click()
  await page.getByLabel('Which Team did you bring?').selectOption({ label: 'Venue Team (Reg M-C)' })
  await page.getByRole('button', { name: 'Link Team' }).click()
  await expect(page.getByTestId('team-snapshot-name')).toHaveText('Venue Team')
  await expect(page.getByTestId('sync-bar')).toContainText('2 changes saved on this phone')

  // Back online, the Team is sent first, then the Tournament waiting on it.
  await context.setOffline(false)
  await expect(page.getByTestId('sync-bar')).toContainText('All 2 changes sent')
  await page.reload()
  await expect(page.getByTestId('team-snapshot-name')).toHaveText('Venue Team')
  await nav.getByRole('link', { name: 'Teams' }).click()
  await expect(row).toBeVisible()
  await expect(page.getByTestId('sync-mark')).toHaveCount(0)
})

test('a Team built with no signal that the server refuses comes back, to fix in the Team builder', async ({
  context,
  page,
}) => {
  await signUp(page, 'smoke-outbox-team-refused')
  await page.goto('/teams/new/build')
  await startTeam(page, 'Online Team', 'Garchomp')
  await saveTeam(page, 'Online Team')
  // A names list on the phone that the server's data no longer agrees with, as after an update.
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('myvgc-names-v4') ?? 'null')
    stored.names.species.missingno = 'MissingNo'
    localStorage.setItem('myvgc-names-v4', JSON.stringify(stored))
  })
  await page.goto('/teams/new/build')

  await context.setOffline(true)
  await startTeam(page, 'Glitch Team', 'MissingNo')
  await saveTeam(page, 'Glitch Team')
  await expect(page.getByTestId('checked-on-sync')).toBeVisible()

  // Checked when it is sent: refused, and kept with the server's message.
  await context.setOffline(false)
  const message = '"missingno" is not a Pokémon in Pokémon Champions.'
  await expect(page.getByTestId('sync-bar')).toContainText("1 change wasn't saved")
  await page.getByTestId('sync-bar').click()
  const change = page.getByTestId('changes-sheet').getByTestId('change')
  await expect(change).toContainText('New Team Glitch Team')
  await expect(change).toContainText(`Not saved: ${message}`)

  // Fix opens the Team builder with the message on the Pokémon build it names.
  await change.getByRole('button', { name: 'Fix' }).click()
  await expect(page.getByRole('heading', { name: 'Fix Team' })).toBeVisible()
  await expect(page.getByTestId('rejected-banner')).toContainText(message)
  await expect(page.getByTestId('build-slot')).toContainText(message)
  await page
    .getByTestId('build-slot')
    .getByRole('button', { name: /MissingNo/ })
    .click()
  await page.getByTestId('build-species-choice').getByRole('button', { name: 'Change' }).click()
  await page.getByRole('combobox', { name: 'Species' }).fill('Incineroar')
  await page.getByRole('option', { name: 'Incineroar', exact: true }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await saveTeam(page, 'Glitch Team')

  await page.reload()
  await expect(page.getByTestId('team-name')).toHaveText('Glitch Team')
  await expect(page.getByTestId('team-pokemon')).toContainText('Incineroar')
  await expect(page.getByTestId('sync-mark')).toHaveCount(0)
})
