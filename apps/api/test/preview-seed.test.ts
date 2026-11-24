import { currentRegulation, today } from '@myvgc/core'
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
    const api = path === '/statistics' ? '/api/statistics' : `/api${path}`
    expect((await get(t.app, api, cookie)).status, path).toBe(200)
  }

  const teams = await json(await get(t.app, '/api/teams', cookie))
  expect(teams.map((team: { name: string }) => team.name).sort()).toEqual([
    'Long names Team',
    'No Sprite Team',
    'Preview Team',
  ])
  // Legal, so a page shows the awkward case and not a legality warning.
  for (const team of teams) expect(team.legality.status, team.name).toBe('legal')
  const noSprite = teams.find((team: { name: string }) => team.name === 'No Sprite Team')
  expect(noSprite.pokemon.map((build: { species: string }) => build.species)).toContain(
    'cramorantgulping',
  )

  const tournamentPath = seed.pages.find((page) => page.label === 'Tournament')!.path
  const tournament = await json(await get(t.app, `/api${tournamentPath}`, cookie))
  expect(tournament.regulation).toBe(currentRegulation(today()))
  expect(tournament.rounds).toHaveLength(4)
  expect(tournament.rounds[0].games[0]).toMatchObject({
    brought: expect.arrayContaining(['floetteeternal']),
    leads: ['floetteeternal', 'basculegion'],
  })

  const { statistics } = await json(await get(t.app, '/api/statistics', cookie))
  expect(statistics.speciesFaced.rows.length).toBeGreaterThan(0)
  expect(statistics.user.leads.rows.length).toBeGreaterThan(0)
})
