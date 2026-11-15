import type { SideStatistics, Statistics } from '@myvgc/core/schema'
import { describe, expect, it } from 'vitest'
import { statisticsTables } from '../app/lib/statistics-tables'

const NAMES: Record<string, string> = { incineroar: 'Incineroar', rillaboom: 'Rillaboom' }
const speciesName = (id: string) => NAMES[id] ?? id

const side = (): SideStatistics => ({
  leadPairs: { rows: [], coverage: { counted: 0, of: 0, noResult: 0, noLeads: 0, oneLead: 0 } },
  leads: { rows: [], coverage: { counted: 0, of: 0, noResult: 0, noLeads: 0 } },
  brought: { rows: [], coverage: { counted: 0, of: 0, noResult: 0, noBrought: 0 } },
})
const stats = (more: Partial<Statistics> = {}): Statistics => ({
  speciesFaced: { rows: [], coverage: { counted: 0, of: 0, noOpponentTeam: 0 } },
  bringRates: {
    rows: [],
    coverage: { counted: 0, of: 0, noResult: 0, noOpponentTeam: 0, noBrought: 0 },
  },
  user: side(),
  opponent: side(),
  rounds: {},
  ...more,
})

describe('statisticsTables', () => {
  it('pairs the User’s side with the Opponent’s, table by table', () => {
    expect(statisticsTables(stats(), speciesName).map((t) => t.title)).toEqual([
      'Species faced',
      'Brought from Opponent’s Teams',
      'Your Brought Pokémon',
      'Opponent’s Brought Pokémon',
      'Your Lead pairs',
      'Opponent’s Lead pairs',
      'Your single Leads',
      'Opponent’s single Leads',
    ])
  })

  it('shows a win-rate table’s W-L-T, and names a Lead pair by both species', () => {
    const row = { played: 3, wins: 2, losses: 1, ties: 0, winRate: 2 / 3, counted: [] }
    const tables = statisticsTables(
      stats({
        opponent: {
          ...side(),
          leadPairs: {
            rows: [{ ...row, species: ['incineroar', 'rillaboom'] }],
            coverage: { counted: 3, of: 3, noResult: 0, noLeads: 0, oneLead: 0 },
          },
        },
      }),
      speciesName,
    )
    const pairs = tables.find((t) => t.title === 'Opponent’s Lead pairs')
    expect(pairs).toMatchObject({
      unit: 'Games',
      headings: { name: 'Leads', outcome: 'W-L-T', rate: 'Win rate' },
      coverage: 'Based on all 3 Games',
      rows: [
        {
          key: 'incineroar rillaboom',
          name: 'Incineroar + Rillaboom',
          played: 3,
          outcome: 2,
          outcomeLabel: '2-1-0',
          rate: 2 / 3,
        },
      ],
    })
  })

  it('shows the bring-rate table’s Games Brought in and its bring rate', () => {
    const [, bringRates] = statisticsTables(
      stats({
        bringRates: {
          rows: [{ species: 'incineroar', played: 4, brought: 3, bringRate: 0.75, counted: [] }],
          coverage: { counted: 4, of: 5, noResult: 1, noOpponentTeam: 0, noBrought: 0 },
        },
      }),
      speciesName,
    )
    expect(bringRates).toMatchObject({
      headings: { name: 'Species', outcome: 'Brought', rate: 'Bring rate' },
      coverage: 'Based on 4 of 5 Games, 1 has no Game result',
      rows: [
        {
          key: 'incineroar',
          name: 'Incineroar',
          outcome: 3,
          outcomeLabel: '3',
          rate: 0.75,
        },
      ],
    })
  })
})
