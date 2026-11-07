/** Sample Data export files for the core tests. */
export const at = '2026-09-19T10:00:00.000Z'
export const ids = {
  team: '00000000-0000-4000-8000-000000000001',
  opponent: '00000000-0000-4000-8000-000000000002',
  noteEntry: '00000000-0000-4000-8000-000000000003',
  tournament: '00000000-0000-4000-8000-000000000004',
  round: '00000000-0000-4000-8000-000000000005',
  opponentTeam: '00000000-0000-4000-8000-000000000006',
}
export const pokemon = [
  {
    species: 'incineroar',
    item: 'sitrusberry',
    ability: 'intimidate',
    nature: 'careful',
    moves: ['fakeout', 'partingshot'],
    statPoints: { hp: 32, atk: 2, def: 0, spa: 0, spd: 32, spe: 0 },
  },
]

/** A version 1 file with one of everything. */
export const versionOne = () => ({
  format: 'myvgc-export',
  version: 1,
  exportedAt: at,
  teams: [
    {
      id: ids.team,
      name: 'Rain',
      regulation: 'M-C',
      notes: '',
      pokemon,
      createdAt: at,
      updatedAt: at,
    },
  ],
  opponents: [
    {
      id: ids.opponent,
      displayName: 'Wolfe',
      aliases: ['wolfey'],
      notes: '',
      noteEntries: [
        {
          id: ids.noteEntry,
          date: '2026-09-19',
          text: 'Leads Incineroar',
          createdAt: at,
          updatedAt: at,
        },
      ],
      createdAt: at,
      updatedAt: at,
    },
  ],
  tournaments: [
    {
      id: ids.tournament,
      name: 'Worlds',
      startDate: '2026-08-28',
      endDate: '2026-08-30',
      eventTier: 'worlds',
      online: false,
      regulation: 'M-C',
      defaultBestOf: 3,
      location: 'San Francisco',
      organizer: null,
      entryFee: { amount: 3500, currency: 'USD' },
      championshipPoints: null,
      playerCount: 300,
      link: null,
      placement: 12,
      dropped: false,
      notes: '',
      team: { teamId: ids.team, name: 'Rain', regulation: 'M-C', pokemon, snapshotAt: at },
      rounds: [
        {
          id: ids.round,
          phase: 'swiss',
          roundNumber: 1,
          stage: null,
          bestOf: 3,
          bye: false,
          result: 'win',
          gameScore: { won: 2, lost: 1 },
          opponentId: ids.opponent,
          notes: '',
          games: [],
          createdAt: at,
          updatedAt: at,
        },
      ],
      createdAt: at,
      updatedAt: at,
    },
  ],
})

/** A file in the current version, version 2: version 1 plus Opponent's Teams (ADR 22). */
export const current = () => {
  const file = versionOne()
  return {
    ...file,
    version: 2,
    tournaments: file.tournaments.map((tournament) => ({
      ...tournament,
      opponentTeams: [
        { id: ids.opponentTeam, opponentId: ids.opponent, pokemon, createdAt: at, updatedAt: at },
      ],
    })),
  }
}
