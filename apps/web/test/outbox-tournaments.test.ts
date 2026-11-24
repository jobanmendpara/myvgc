import type { DashboardView, TeamView, TournamentView } from '@myvgc/core/schema'
import { describe, expect, it } from 'vitest'
import { checkBeforeSaving } from '../app/lib/api'
import type { WriteDraft } from '../app/lib/outbox'
import { applyPending, revertWrite } from '../app/lib/outbox-apply'
import {
  nextWrite,
  OUTBOX_FORMAT,
  type OutboxState,
  type OutboxWrite,
} from '../app/lib/outbox-rules'
import {
  changeTitle,
  discardText,
  notYetCreated,
  rejectedTournament,
  tournamentMarks,
  tournamentRows,
} from '../app/lib/outbox-view'
import {
  addTournament,
  deleteTournament,
  editTournament,
  linkTournamentTeam,
  logRound,
  reviseTournament,
  tournamentChangesFor,
  unlinkTournamentTeam,
} from '../app/lib/outbox-writes'

// Creating, changing and deleting a Tournament, and linking its Team, with no signal (DEV-204).

let order = 0
/** A draft as the outbox keeps it, pending unless told otherwise. */
const kept = (draft: WriteDraft, state?: OutboxWrite['state']): OutboxWrite => ({
  ...draft,
  userId: 'u1',
  format: OUTBOX_FORMAT,
  order: ++order,
  createdAt: `2026-11-24T10:00:0${order % 10}.000Z`,
  state: state ?? { status: 'pending', attempts: 0 },
})
const refused = (message: string, fields?: Record<string, string>) =>
  ({ status: 'rejected', message, ...(fields ? { fields } : {}) }) as const

function stateOf(writes: OutboxWrite[]): OutboxState {
  return {
    pending: writes.filter((w) => w.state.status === 'pending'),
    rejected: writes.filter((w) => w.state.status === 'rejected'),
    waitingForLogin: false,
  }
}

const FIELDS = {
  name: '  Portland Regional ',
  startDate: '2026-11-22',
  endDate: null,
  eventTier: 'regional',
  online: false,
  regulation: 'M-C',
  defaultBestOf: 3,
  location: 'Portland, OR',
  organizer: '',
  entryFee: { amount: 5000, currency: 'USD' },
  championshipPoints: null,
  playerCount: 600,
  link: null,
  placement: null,
  dropped: false,
  notes: '',
} as const

const SAVED: TournamentView = {
  id: '00000000-0000-4000-8000-0000000000aa',
  name: 'Vancouver Locals',
  startDate: '2026-10-01',
  endDate: null,
  eventTier: 'local',
  online: false,
  regulation: 'M-C',
  defaultBestOf: 1,
  location: null,
  organizer: 'Pallet Games',
  entryFee: null,
  championshipPoints: null,
  playerCount: 16,
  link: null,
  placement: null,
  dropped: false,
  notes: '',
  upcoming: false,
  team: null,
  rounds: [],
  opponentTeams: [],
  opponentAgeDivisions: [],
  teamsheet: null,
  record: { swiss: { wins: 0, losses: 0, ties: 0 }, topCut: { wins: 0, losses: 0, ties: 0 } },
  warnings: [],
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
}

const TEAM = {
  id: '00000000-0000-4000-8000-0000000000bb',
  name: 'Fairy rain',
  regulation: 'M-B',
  pokemon: [{ species: 'floetteeternal', names: { species: 'Floette-Eternal' } }],
  legality: { regulation: 'M-B', status: 'legal', problems: [] },
} as unknown as TeamView

const WIN = { phase: 'swiss', result: 'win', bye: false, notes: '', games: [] } as never

describe('A Tournament created with no signal', () => {
  it('gets its ID on the phone, and the Rounds logged in it wait for its create', () => {
    const create = kept(addTournament(FIELDS))
    const id = create.subject.tournamentId!
    expect(create.request).toMatchObject({ method: 'POST', body: { id, name: FIELDS.name } })
    expect(changeTitle(create)).toBe('New Tournament Portland Regional')

    const round = kept(logRound({ id, name: 'Portland Regional' }, WIN, null))
    expect(nextWrite([create, round])?.id).toBe(create.id)
    expect(nextWrite([create, round], new Set([create.id]))).toBeUndefined()
    // Still held back while the server refuses the Tournament.
    expect(nextWrite([{ ...create, state: refused('No.') }, round])).toBeUndefined()
  })

  it('shows at once in the Tournaments list and opens before the server has it', () => {
    const create = kept(addTournament(FIELDS))
    const id = create.subject.tournamentId!
    const list = applyPending(['tournaments'], [SAVED], [create]) as TournamentView[]
    expect(list.map((t) => t.name)).toEqual(['Portland Regional', 'Vancouver Locals'])
    expect(list[0]).toMatchObject({ id, organizer: null, location: 'Portland, OR', team: null })

    const round = kept(logRound({ id, name: 'Portland Regional' }, WIN, null))
    const page = applyPending(['tournament', id], undefined, [create, round]) as TournamentView
    expect(page).toMatchObject({ id, name: 'Portland Regional', defaultBestOf: 3 })
    expect(page.record.swiss).toEqual({ wins: 1, losses: 0, ties: 0 })
    expect(applyPending(['tournament', 'other'], undefined, [create])).toBeUndefined()
  })

  it('is marked Not synced in the list until the server has it', () => {
    const create = kept(addTournament(FIELDS))
    const marks = tournamentMarks(stateOf([create]))
    expect(marks.get(create.subject.tournamentId!)?.status).toBe('waiting')
    expect(notYetCreated(stateOf([create]), create.subject.tournamentId!)).toBe(true)
    expect(notYetCreated(stateOf([create]), SAVED.id)).toBe(false)
  })

  it('stays in the list once refused, marked Not saved, to fix in the Tournament form', () => {
    const create = kept(
      addTournament(FIELDS),
      refused('There were only 600 players.', { placement: 'There were only 600 players.' }),
    )
    const id = create.subject.tournamentId!
    const state = stateOf([create])
    const list = applyPending(['tournaments'], [SAVED], state.pending) as TournamentView[]
    const rows = tournamentRows(list, state)
    expect(rows.map((t) => t.id)).toEqual([id, SAVED.id])
    expect(tournamentMarks(state).get(id)?.status).toBe('rejected')
    expect(rejectedTournament(state, id)).toBe(create)
    // Its page still opens, so it can be fixed.
    expect(applyPending(['tournament', id], undefined, [create])).toMatchObject({ id })

    const fix = reviseTournament(create, { ...FIELDS, name: 'Portland' })
    expect(fix.request?.body).toMatchObject({ id, name: 'Portland' })
    expect(fix.label).toBe('New Tournament Portland')
  })

  it('says that discarding it takes the Rounds logged in it along', () => {
    const create = kept(addTournament(FIELDS), refused('No.'))
    const ref = { id: create.subject.tournamentId!, name: 'Portland Regional' }
    const rounds = [kept(logRound(ref, WIN, null)), kept(logRound(ref, WIN, null))]
    const other = kept(logRound({ id: SAVED.id, name: SAVED.name }, WIN, null))
    const all = [create, ...rounds, other]
    expect(discardText(create, all)).toEqual({
      title: 'Discard the new Tournament Portland Regional?',
      body: 'It was never saved to your account, so the Tournament and the 2 Rounds logged in it go from this phone.',
    })
    expect(discardText(create, [create]).body).toBe(
      'It was never saved to your account, so the Tournament goes from this phone.',
    )
  })

  it('leaves the list when the create is discarded', () => {
    const create = kept(addTournament(FIELDS))
    const list = applyPending(['tournaments'], [SAVED], [create]) as TournamentView[]
    expect(revertWrite(['tournaments'], list, create)).toEqual([SAVED])
  })
})

describe('A Tournament changed with no signal', () => {
  it('shows the new details at once, and puts them back when discarded', () => {
    const edit = kept(editTournament(SAVED, { ...FIELDS, name: 'Vancouver Cup', placement: 3 }))
    expect(edit.request).toMatchObject({ method: 'PATCH', url: `/api/tournaments/${SAVED.id}` })
    expect(edit.label).toBe('Changes to Vancouver Cup')
    const page = applyPending(['tournament', SAVED.id], SAVED, [edit]) as TournamentView
    expect(page).toMatchObject({ name: 'Vancouver Cup', placement: 3, organizer: null })
    expect(tournamentMarks(stateOf([edit])).get(SAVED.id)?.status).toBe('waiting')
    expect(revertWrite(['tournament', SAVED.id], page, edit)).toMatchObject({
      name: 'Vancouver Locals',
      organizer: 'Pallet Games',
      placement: null,
    })
  })

  it('checks changes against the Tournament as it will be saved', () => {
    expect(() => checkBeforeSaving(tournamentChangesFor(SAVED), { placement: 17 })).toThrow(
      expect.objectContaining({ fields: { placement: 'There were only 16 players.' } }),
    )
    expect(() => checkBeforeSaving(tournamentChangesFor(SAVED), { placement: 3 })).not.toThrow()
  })

  it('finds the rejected change to fix when the Tournament form is opened', () => {
    const edit = kept(editTournament(SAVED, { placement: 3 }), refused('No.'))
    expect(rejectedTournament(stateOf([edit]), SAVED.id)).toBe(edit)
    const fix = reviseTournament(edit, { ...FIELDS, name: 'Vancouver Cup' })
    expect(fix.request).toMatchObject({ method: 'PATCH', body: { name: 'Vancouver Cup' } })
    expect(fix.label).toBe('Changes to Vancouver Cup')
  })

  it('links the User’s Team, waiting for that Team should it be new too', () => {
    const link = kept(linkTournamentTeam(SAVED, TEAM))
    expect(link.request).toEqual({
      method: 'PUT',
      url: `/api/tournaments/${SAVED.id}/team`,
      body: { teamId: TEAM.id },
    })
    expect(link.series).toEqual([`tournament:${SAVED.id}`, `team:${TEAM.id}`])
    const page = applyPending(['tournament', SAVED.id], SAVED, [link]) as TournamentView
    expect(page.team).toMatchObject({
      teamId: TEAM.id,
      name: 'Fairy rain',
      // Judged against the Tournament's Regulation by the server, not here.
      legality: { regulation: 'M-C', status: 'unchecked' },
    })
    expect(page.warnings).toEqual(['The Team is tagged Reg M-B, but this Tournament is Reg M-C.'])

    const unlink = kept(unlinkTournamentTeam(page))
    const after = applyPending(['tournament', SAVED.id], page, [unlink]) as TournamentView
    expect(after).toMatchObject({ team: null, warnings: [] })
    expect(revertWrite(['tournament', SAVED.id], after, unlink)).toMatchObject({
      team: { name: 'Fairy rain' },
    })
  })
})

describe('A Tournament deleted with no signal', () => {
  it('stays in the list, struck through, until the server has it', () => {
    const removal = kept(deleteTournament(SAVED))
    const state = stateOf([removal])
    const list = applyPending(['tournaments'], [SAVED], [removal]) as TournamentView[]
    expect(list).toEqual([])
    expect(tournamentRows(list, state).map((t) => t.id)).toEqual([SAVED.id])
    expect(tournamentMarks(state).get(SAVED.id)?.status).toBe('deleting')
    expect(revertWrite(['tournaments'], list, removal)).toEqual([SAVED])
  })
})

describe('The dashboard with Tournaments not yet synced', () => {
  const dashboard = (tournamentsPlayed: number) =>
    ({
      filters: {
        regulation: 'M-C',
        season: null,
        from: null,
        to: null,
        eventTier: [],
        setting: null,
      },
      summary: { tournamentsPlayed },
    }) as unknown as DashboardView

  it('counts them from the cached Tournaments list', () => {
    const create = kept(addTournament({ ...FIELDS, placement: 9 }))
    const view = applyPending(['dashboard', {}], dashboard(0), [create], {
      tournaments: [SAVED],
    }) as DashboardView
    expect(view.summary.tournamentsPlayed).toBe(1)
    expect(view.summary.bestPlacements).toMatchObject([{ name: 'Portland Regional', placement: 9 }])
  })

  it('stays as the server sent it with nothing pending, or no list cached', () => {
    const view = dashboard(4)
    expect(applyPending(['dashboard', {}], view, [], { tournaments: [SAVED] })).toBe(view)
    const create = kept(addTournament(FIELDS))
    expect(applyPending(['dashboard', {}], view, [create])).toBe(view)
  })
})
