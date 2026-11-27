import { championsNames, currentRegulation, displayName, judgeTeam, today } from '@myvgc/core'
import { afterEach, expect, it } from 'vitest'
import { PREVIEW_EMAIL, PREVIEW_PASSWORD, seedPreview } from '../scripts/preview-seed'
import { APP_URL, type TestApp, cookieFrom, createTestApp, get, json, post } from './app'

let t: TestApp
afterEach(async () => {
  await t?.client.close()
})

it('seeds the preview through the app, with Statistics showing rows without a query', async () => {
  t = await createTestApp()
  const seed = await seedPreview(t.app, APP_URL, today())

  const login = await post(t.app, '/api/auth/sign-in/email', {
    email: PREVIEW_EMAIL,
    password: PREVIEW_PASSWORD,
  })
  const cookie = cookieFrom(login)

  // Every page the start-up message lists has data behind it.
  for (const { path } of seed.pages) {
    // A Round has no route of its own; its Tournament's has it.
    const api =
      path === '/statistics' ? '/api/statistics' : `/api${path.replace(/\/rounds\/.*/, '')}`
    expect((await get(t.app, api, cookie)).status, path).toBe(200)
  }

  const teams = await json(await get(t.app, '/api/teams', cookie))
  expect(teams.map((team: { name: string }) => team.name).sort()).toEqual([
    'Long items Team',
    'Long names Team',
    'Preview Team',
  ])
  // Legal, so a page shows the awkward case and not a legality warning.
  for (const team of teams) expect(team.legality.status, team.name).toBe('legal')

  // Six different items, the longest names in Champions: the longest of all, and none shorter
  // than the sixth longest (DEV-242).
  const lengths = Object.values(championsNames().items)
    .map((name) => name.length)
    .sort((a, b) => b - a)
  const longItems = teams.find((team: { name: string }) => team.name === 'Long items Team')
  const items = longItems.pokemon.map((build: { item: string }) => displayName('item', build.item))
  expect(new Set(items).size).toBe(6)
  expect(Math.max(...items.map((name: string) => name.length))).toBe(lengths[0])
  for (const name of items) expect(name.length, name).toBeGreaterThanOrEqual(lengths[5]!)

  const tournamentPath = seed.pages.find((page) => page.label === 'Tournament')!.path
  const tournament = await json(await get(t.app, `/api${tournamentPath}`, cookie))
  expect(tournament.regulation).toBe(currentRegulation(today()))
  expect(tournament.rounds).toHaveLength(5)
  expect(tournament.rounds[0].games[0]).toMatchObject({
    brought: expect.arrayContaining(['floetteeternal']),
    leads: ['floetteeternal', 'basculegion'],
  })

  // An Opponent's Team with items, abilities and moves, legal, so its rows run to several lines.
  const full = tournament.opponentTeams.find((team: { pokemon: { moves: string[] }[] }) =>
    team.pokemon.every((build) => build.moves.length === 4),
  )
  expect(full.pokemon).toHaveLength(6)
  for (const build of full.pokemon) {
    expect(build.item, build.species).toBeTruthy()
    expect(build.ability, build.species).toBeTruthy()
  }
  expect(judgeTeam(full.pokemon, tournament.regulation).status).toBe('legal')

  const { statistics } = await json(await get(t.app, '/api/statistics', cookie))
  expect(statistics.speciesFaced.rows.length).toBeGreaterThan(0)
  expect(statistics.user.leads.rows.length).toBeGreaterThan(0)
  expect(
    statistics.opponent.leadPairs.rows.map((row: { species: string[] }) => row.species),
  ).toContainEqual(['basculegion', 'incineroar'])
})
