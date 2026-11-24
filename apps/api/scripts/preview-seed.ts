// What `pnpm preview` puts in its throwaway database (DEV-184, DEV-197): a User with Teams, a
// Tournament with Rounds, Games and Opponents, and the awkward cases a UI change should be looked at
// with (long species names, a species with no Sprite file, as a Team's and as a Lead (DEV-199), and
// an Opponent's Team with items, abilities and moves). It goes through the app's own routes,
// as the web app would, so whatever the routes check is checked here too. Tested by
// test/preview-seed.test.ts.
import { readFileSync } from 'node:fs'
import {
  type CalendarDate,
  type GameInput,
  type NewRound,
  type NewTeam,
  type NewTournament,
  type SavedRound,
  type TeamView,
  type TournamentView,
  currentRegulation,
  readPaste,
} from '@myvgc/core'
import type { Hono } from 'hono'
import type { AppEnv } from '../src/app'

export const PREVIEW_EMAIL = 'preview@example.com'
export const PREVIEW_PASSWORD = 'preview-password'

/** A seeded page, by what it shows and its path in the web app. */
export interface SeededPage {
  label: string
  path: string
}

export interface PreviewSeed {
  email: string
  password: string
  pages: SeededPage[]
}

// The 2026 World Championships winner's team list, as in the smoke test.
const WORLDS_PASTE = readFileSync(
  new URL('../../../packages/core/test/fixtures/worlds-2026-yamazaki-ots.txt', import.meta.url),
  'utf8',
)

// Species with the longest names that are legal in Champions; the API turned down Urshifu,
// Amoonguss, Tornadus and Ogerpon-Hearthflame on 2026-11-23.
const LONG_NAMES_PASTE = [
  'Sinistcha-Masterpiece',
  'Tauros-Paldea-Combat',
  'Alcremie-Rainbow-Swirl',
  'Vivillon-High Plains',
  'Maushold-Four',
  'Kommo-o',
]
  .map((species) => `${species}\n- Protect\n`)
  .join('\n')

// Cramorant-Gulping is a battle-only form that core accepts but Champions lacks, so it has no
// Sprite file (DEV-173) and pages show its name alone.
const NO_SPRITE_PASTE = [WORLDS_PASTE.split('\n\n')[0], 'Cramorant-Gulping\n- Protect\n'].join(
  '\n\n',
)

// An Opponent's Team with an item, ability, Nature and four moves on each Pokémon, so its rows run
// to several lines (DEV-199). Cramorant-Gulping, with no Sprite file, is one of their Leads. Legal
// in Champions: test/preview-seed.test.ts judges it.
const FULL_OPPONENT_PASTE = `Incineroar @ Sitrus Berry
Ability: Intimidate
Careful Nature
- Fake Out
- Flare Blitz
- Parting Shot
- Will-O-Wisp

Cramorant-Gulping @ Shell Bell
Ability: Gulp Missile
Modest Nature
- Surf
- Hurricane
- Ice Beam
- Protect

Whimsicott @ Focus Sash
Ability: Prankster
Timid Nature
- Tailwind
- Moonblast
- Encore
- Protect

Archaludon @ Leftovers
Ability: Stamina
Modest Nature
- Electro Shot
- Flash Cannon
- Draco Meteor
- Protect

Pelipper @ Mystic Water
Ability: Drizzle
Modest Nature
- Weather Ball
- Hurricane
- Tailwind
- Protect

Farigiraf @ Lum Berry
Ability: Armor Tail
Quiet Nature
- Psychic
- Hyper Voice
- Trick Room
- Helping Hand
`

function buildsOf(paste: string) {
  const read = readPaste(paste)
  if (!read.ok) throw new Error(`A seeded paste doesn't read: ${read.errors[0]?.message}`)
  return read.pokemon
}

/** A Game as the Round form sends it. */
const game = (
  number: 1 | 2 | 3,
  result: 'win' | 'loss',
  [brought, leads]: [string[], string[]],
  [opponentBrought, opponentLeads]: [string[], string[]],
): GameInput => ({ number, result, brought, leads, opponentBrought, opponentLeads })

const species = (ids: string[]) => ids.map((id) => ({ species: id }))

/**
 * Signs up the preview User and fills their account through `app`, as of `today`. Everything is in
 * the Regulation in force on `today`, which is what Statistics shows without a query.
 */
export async function seedPreview(
  app: Hono<AppEnv>,
  appUrl: string,
  today: CalendarDate,
): Promise<PreviewSeed> {
  const signUp = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: appUrl },
    body: JSON.stringify({ email: PREVIEW_EMAIL, password: PREVIEW_PASSWORD, name: 'Preview' }),
  })
  if (!signUp.ok) throw new Error(`Signing up the preview User failed: ${signUp.status}`)
  const cookie = signUp.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')

  async function send<T>(method: 'POST' | 'PUT', path: string, body: unknown): Promise<T> {
    const res = await app.request(path, {
      method,
      headers: { 'content-type': 'application/json', origin: appUrl, cookie },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`)
    return (await res.json()) as T
  }

  const regulation = currentRegulation(today)
  const addTeam = async (name: string, paste: string) =>
    (
      await send<{ team: TeamView }>('POST', '/api/teams', {
        name,
        regulation,
        paste,
      } satisfies NewTeam)
    ).team

  const worlds = await addTeam('Preview Team', WORLDS_PASTE)
  const longNames = await addTeam('Long names Team', LONG_NAMES_PASTE)
  const noSprite = await addTeam('No Sprite Team', NO_SPRITE_PASTE)

  const tournament = await send<TournamentView>('POST', '/api/tournaments', {
    name: 'Preview Regional Championships',
    startDate: today,
    eventTier: 'regional',
    regulation,
    defaultBestOf: 3,
  } satisfies NewTournament)
  await send('PUT', `/api/tournaments/${tournament.id}/team`, { teamId: worlds.id })

  const logRound = (round: NewRound) =>
    send<SavedRound>('POST', `/api/tournaments/${tournament.id}/rounds`, round)

  const longOpponent = [
    'sinistchamasterpiece',
    'taurospaldeacombat',
    'alcremierainbowswirl',
    'mausholdfour',
    'kommoo',
    'incineroar',
  ]
  const first = await logRound({
    newOpponentName: 'Alexandria Montgomery-Fitzgerald',
    bestOf: 3,
    result: 'win',
    gameScore: { won: 2, lost: 1 },
    opponentTeam: species(longOpponent),
    games: [
      game(
        1,
        'win',
        [
          ['floetteeternal', 'basculegion', 'kingambit', 'dragonite'],
          ['floetteeternal', 'basculegion'],
        ],
        [longOpponent.slice(0, 4), ['sinistchamasterpiece', 'taurospaldeacombat']],
      ),
      game(
        2,
        'loss',
        [
          ['floetteeternal', 'garchomp', 'sneasler', 'kingambit'],
          ['garchomp', 'sneasler'],
        ],
        [longOpponent.slice(2), ['alcremierainbowswirl', 'incineroar']],
      ),
      game(
        3,
        'win',
        [
          ['floetteeternal', 'basculegion', 'kingambit', 'dragonite'],
          ['floetteeternal', 'basculegion'],
        ],
        [
          ['sinistchamasterpiece', 'taurospaldeacombat', 'kommoo', 'incineroar'],
          ['incineroar', 'kommoo'],
        ],
      ),
    ],
  })

  const sun = ['incineroar', 'rillaboom', 'whimsicott', 'pelipper', 'archaludon', 'farigiraf']
  const second = await logRound({
    newOpponentName: 'Sam',
    bestOf: 3,
    result: 'win',
    gameScore: { won: 2, lost: 0 },
    opponentTeam: species(sun),
    games: [
      game(
        1,
        'win',
        [
          ['floetteeternal', 'basculegion', 'kingambit', 'garchomp'],
          ['floetteeternal', 'basculegion'],
        ],
        [sun.slice(0, 4), ['incineroar', 'rillaboom']],
      ),
      game(
        2,
        'win',
        [
          ['floetteeternal', 'basculegion', 'kingambit', 'garchomp'],
          ['floetteeternal', 'basculegion'],
        ],
        [sun.slice(2), ['pelipper', 'archaludon']],
      ),
    ],
  })

  // Only part of their Team was seen, and Game 2 has no Pokémon recorded for them (ADR 21).
  await logRound({
    newOpponentName: 'Jordan Lee',
    bestOf: 3,
    result: 'loss',
    gameScore: { won: 0, lost: 2 },
    opponentTeam: species(['garchomp', 'kingambit', 'dragonite']),
    games: [
      game(
        1,
        'loss',
        [
          ['garchomp', 'sneasler', 'dragonite', 'kingambit'],
          ['garchomp', 'sneasler'],
        ],
        [
          ['garchomp', 'kingambit'],
          ['garchomp', 'kingambit'],
        ],
      ),
      game(
        2,
        'loss',
        [
          ['floetteeternal', 'basculegion', 'dragonite', 'kingambit'],
          ['dragonite', 'kingambit'],
        ],
        [[], []],
      ),
    ],
  })

  // Cramorant-Gulping, with no Sprite file, leads in both Games, so Statistics has a Lead pair
  // with no Sprite (DEV-199).
  const full = await logRound({
    newOpponentName: 'Riley Park',
    bestOf: 3,
    result: 'win',
    gameScore: { won: 2, lost: 0 },
    opponentTeam: buildsOf(FULL_OPPONENT_PASTE),
    games: [
      game(
        1,
        'win',
        [
          ['floetteeternal', 'basculegion', 'kingambit', 'dragonite'],
          ['floetteeternal', 'kingambit'],
        ],
        [
          ['incineroar', 'cramorantgulping', 'whimsicott', 'archaludon'],
          ['cramorantgulping', 'incineroar'],
        ],
      ),
      game(
        2,
        'win',
        [
          ['floetteeternal', 'basculegion', 'kingambit', 'garchomp'],
          ['floetteeternal', 'basculegion'],
        ],
        [
          ['incineroar', 'cramorantgulping', 'pelipper', 'farigiraf'],
          ['cramorantgulping', 'pelipper'],
        ],
      ),
    ],
  })

  await logRound({ bye: true })

  const opponentPath = (saved: SavedRound) => `/opponents/${saved.round.opponent!.id}`
  return {
    email: PREVIEW_EMAIL,
    password: PREVIEW_PASSWORD,
    pages: [
      { label: 'Team', path: `/teams/${worlds.id}` },
      { label: 'Team with long species names', path: `/teams/${longNames.id}` },
      { label: 'Team with a species that has no Sprite', path: `/teams/${noSprite.id}` },
      { label: 'Tournament', path: `/tournaments/${tournament.id}` },
      { label: 'Opponent with a long name and long species names', path: opponentPath(first) },
      { label: 'Opponent', path: opponentPath(second) },
      {
        label: 'Opponent with a full Opponent’s Team and a Lead with no Sprite',
        path: opponentPath(full),
      },
      {
        label: 'Round with Games and a full Opponent’s Team',
        path: `/tournaments/${tournament.id}/rounds/${full.round.id}`,
      },
      { label: 'Opponents', path: '/opponents' },
      { label: 'Statistics', path: '/statistics' },
    ],
  }
}
