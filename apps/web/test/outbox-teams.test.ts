import type { TeamBody, TeamView, TournamentView } from '@myvgc/core/schema'
import { describe, expect, it } from 'vitest'
import type { WriteDraft } from '../app/lib/outbox'
import { applyPending, revertWrite, withTeamWrite } from '../app/lib/outbox-apply'
import {
  discardedWith,
  nextWrite,
  OUTBOX_FORMAT,
  type OutboxState,
  type OutboxWrite,
  settle,
} from '../app/lib/outbox-rules'
import {
  changeTitle,
  discardText,
  rejectedTeam,
  teamMarks,
  teamNotYetCreated,
  teamRows,
} from '../app/lib/outbox-view'
import {
  addTeam,
  deleteTeam,
  editTeam,
  linkTournamentTeam,
  reviseTeam,
} from '../app/lib/outbox-writes'

// Building, changing and deleting a Team with no signal, checked by the server when it is sent
// (DEV-206).

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

const NO_POINTS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }

const BODY: TeamBody = {
  name: 'Sun',
  regulation: 'M-C',
  notes: '',
  replicaTeamId: '',
  pokemon: [
    {
      species: 'incineroar',
      ability: 'intimidate',
      nature: 'careful',
      moves: ['fakeout'],
      statPoints: NO_POINTS,
    },
  ],
}

/** The names list kept on the phone, as far as these Teams need it. */
const NAMES = {
  species: { incineroar: 'Incineroar', garchomp: 'Garchomp' },
  moves: { fakeout: 'Fake Out' },
  items: {},
  abilities: { intimidate: 'Intimidate' },
}

const SAVED: TeamView = {
  id: '00000000-0000-4000-8000-0000000000bb',
  name: 'Rain',
  regulation: 'M-C',
  notes: 'Lead',
  replicaTeamId: '',
  pokemon: [
    {
      species: 'garchomp',
      moves: [],
      statPoints: NO_POINTS,
      names: { species: 'Garchomp', moves: [] },
    },
  ],
  legality: { regulation: 'M-C', status: 'legal', problems: [] },
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
}

const TOURNAMENT = {
  id: '00000000-0000-4000-8000-0000000000aa',
  name: 'Portland Regional',
  regulation: 'M-C',
  team: null,
} as unknown as TournamentView

describe('A Team built with no signal', () => {
  it('gets its ID on the phone and is sent unchecked, for the server to check', () => {
    const create = kept(addTeam(BODY, NAMES))
    const id = create.subject.teamId!
    expect(create.request).toEqual({ method: 'POST', url: '/api/teams', body: { ...BODY, id } })
    expect(create.series).toEqual([`team:${id}`])
    expect(create.creates).toBe(`team:${id}`)
    expect(changeTitle(create)).toBe('New Team Sun')
  })

  it('shows at once, first in the Teams list, named from the names on the phone and not checked', () => {
    const create = kept(addTeam(BODY, NAMES))
    const id = create.subject.teamId!
    const list = applyPending(['teams'], [SAVED], [create]) as TeamView[]
    expect(list.map((t) => t.name)).toEqual(['Sun', 'Rain'])
    expect(list[0]).toMatchObject({
      id,
      pokemon: [
        {
          species: 'incineroar',
          names: { species: 'Incineroar', ability: 'Intimidate', nature: 'Careful' },
        },
      ],
      legality: { regulation: 'M-C', status: 'unchecked', problems: [] },
    })
    // Its page opens before the server has it.
    expect(applyPending(['team', id], undefined, [create])).toMatchObject({ id, name: 'Sun' })
    expect(applyPending(['team', SAVED.id], undefined, [create])).toBeUndefined()
    // Its paste is the server's to make.
    expect(applyPending(['team', id, 'paste'], undefined, [create])).toBeUndefined()
  })

  it('is marked Not synced until the server has it', () => {
    const create = kept(addTeam(BODY, NAMES))
    const id = create.subject.teamId!
    expect(teamMarks(stateOf([create])).get(id)?.status).toBe('waiting')
    expect(teamNotYetCreated(stateOf([create]), id)).toBe(true)
    expect(teamNotYetCreated(stateOf([create]), SAVED.id)).toBe(false)
  })

  it('goes before the changes to it, which go in series', () => {
    const create = kept(addTeam(BODY, NAMES))
    const team = applyPending(['team', create.subject.teamId!], undefined, [create]) as TeamView
    const edit = kept(editTeam(team, { ...BODY, name: 'Sunny' }, NAMES))
    const removal = kept(deleteTeam(team))
    const writes = [create, edit, removal]
    expect(nextWrite(writes)?.id).toBe(create.id)
    expect(nextWrite(writes, new Set([create.id]))).toBeUndefined()
    expect(nextWrite([edit, removal])?.id).toBe(edit.id)
  })

  it('holds back a Tournament set to it until its create is sent, also while refused', () => {
    const create = kept(addTeam(BODY, NAMES))
    const team = applyPending(['team', create.subject.teamId!], undefined, [create]) as TeamView
    const link = kept(linkTournamentTeam(TOURNAMENT, team))
    expect(nextWrite([create, link])?.id).toBe(create.id)
    expect(nextWrite([create, link], new Set([create.id]))).toBeUndefined()
    expect(nextWrite([{ ...create, state: refused('No.') }, link])).toBeUndefined()
    // Once sent, the Tournament goes.
    expect(nextWrite([link])?.id).toBe(link.id)
  })

  it('takes the changes waiting on it along when discarded, and says so', () => {
    const create = kept(addTeam(BODY, NAMES), refused('No.'))
    const team = applyPending(['team', create.subject.teamId!], undefined, [create]) as TeamView
    const link = kept(linkTournamentTeam(TOURNAMENT, team))
    const edit = kept(editTeam(team, { ...BODY, name: 'Sunny' }, NAMES))
    const other = kept(editTeam(SAVED, { ...BODY, name: 'Rainy' }, NAMES))
    const all = [create, link, edit, other]
    expect(discardedWith(all, create).map((w) => w.id)).toEqual([create.id, link.id, edit.id])
    expect(discardText(create, all)).toEqual({
      title: 'Discard the new Team Sun?',
      body: 'It was never saved to your account, so the Team and 2 other changes to it go from this phone.',
    })
    expect(discardText(create, [create]).body).toBe(
      'It was never saved to your account, so the Team goes from this phone.',
    )
  })

  it('leaves the list when the create is discarded', () => {
    const create = kept(addTeam(BODY, NAMES))
    const list = applyPending(['teams'], [SAVED], [create]) as TeamView[]
    expect(revertWrite(['teams'], list, create)).toEqual([SAVED])
  })
})

describe('A Team the server refuses', () => {
  const answer = {
    status: 400,
    body: {
      error: 'Invalid request',
      fields: { 'pokemon.0.species': '"missingno" is not a Pokémon in Pokémon Champions.' },
    },
  }

  it('comes back rejected with the message on the Pokémon build it names', () => {
    const create = kept(addTeam(BODY, NAMES))
    expect(settle(create, answer)).toEqual({
      outcome: 'rejected',
      status: 400,
      message: '"missingno" is not a Pokémon in Pokémon Champions.',
      fields: answer.body.fields,
    })
  })

  it('stays in the list, marked Not saved, to fix in the Team builder', () => {
    const create = kept(addTeam(BODY, NAMES), refused('No.', answer.body.fields))
    const id = create.subject.teamId!
    const state = stateOf([create])
    const list = applyPending(['teams'], [SAVED], state.pending) as TeamView[]
    expect(list).toEqual([SAVED])
    expect(teamRows(list, state).map((t) => t.id)).toEqual([id, SAVED.id])
    expect(teamMarks(state).get(id)?.status).toBe('rejected')
    expect(rejectedTeam(state, id)).toBe(create)
    // Its page still opens, so it can be fixed.
    expect(applyPending(['team', id], undefined, [create])).toMatchObject({ id, name: 'Sun' })
  })

  it('is sent again as fixed, keeping its ID', () => {
    const create = kept(addTeam(BODY, NAMES), refused('No.'))
    const id = create.subject.teamId!
    const fixed = { ...BODY, name: 'Sun fixed' }
    const fix = reviseTeam(create, fixed, NAMES)
    expect(fix.request).toEqual({ method: 'POST', url: '/api/teams', body: { ...fixed, id } })
    expect(fix.label).toBe('New Team Sun fixed')
    expect(fix.subject?.after).toMatchObject({ id, name: 'Sun fixed' })
  })
})

describe('A Team changed with no signal', () => {
  it('replaces the Team at once, and puts it back when discarded', () => {
    const edit = kept(editTeam(SAVED, { ...BODY, name: 'Rain, again' }, NAMES))
    expect(edit.request).toEqual({
      method: 'PUT',
      url: `/api/teams/${SAVED.id}`,
      body: { ...BODY, name: 'Rain, again' },
    })
    expect(edit.label).toBe('Changes to Rain, again')
    const page = applyPending(['team', SAVED.id], SAVED, [edit]) as TeamView
    expect(page).toMatchObject({
      id: SAVED.id,
      name: 'Rain, again',
      createdAt: SAVED.createdAt,
      pokemon: [{ names: { species: 'Incineroar' } }],
      legality: { status: 'unchecked' },
    })
    const list = applyPending(['teams'], [SAVED], [edit]) as TeamView[]
    expect(list.map((t) => t.name)).toEqual(['Rain, again'])
    expect(teamMarks(stateOf([edit])).get(SAVED.id)?.status).toBe('waiting')
    expect(revertWrite(['team', SAVED.id], page, edit)).toEqual(SAVED)
    expect(revertWrite(['teams'], list, edit)).toEqual([SAVED])
  })

  it('opens a refused change in the Team builder as that change had it', () => {
    const edit = kept(editTeam(SAVED, { ...BODY, name: 'Rain, again' }, NAMES), refused('No.'))
    expect(rejectedTeam(stateOf([edit]), SAVED.id)).toBe(edit)
    expect(withTeamWrite(SAVED, edit)).toMatchObject({ name: 'Rain, again' })
    // A refused change is shown only where it is fixed.
    expect(applyPending(['team', SAVED.id], SAVED, [edit])).toBe(SAVED)
    const fix = reviseTeam(edit, { ...BODY, name: 'Rain, fixed' }, NAMES)
    expect(fix.request).toMatchObject({ method: 'PUT', body: { name: 'Rain, fixed' } })
    expect(fix.label).toBe('Changes to Rain, fixed')
  })

  it('leaves the lists as they were with nothing pending on a Team', () => {
    const list = [SAVED]
    expect(applyPending(['teams'], list, [])).toBe(list)
    expect(applyPending(['team', SAVED.id], SAVED, [])).toBe(SAVED)
  })
})

describe('A Team deleted with no signal', () => {
  it('stays in the list, struck through, until the server has it', () => {
    const removal = kept(deleteTeam(SAVED))
    expect(removal.request).toEqual({ method: 'DELETE', url: `/api/teams/${SAVED.id}` })
    expect(removal.label).toBe('Deleting Rain')
    const state = stateOf([removal])
    const list = applyPending(['teams'], [SAVED], [removal]) as TeamView[]
    expect(list).toEqual([])
    expect(teamRows(list, state).map((t) => t.id)).toEqual([SAVED.id])
    expect(teamMarks(state).get(SAVED.id)?.status).toBe('deleting')
    expect(revertWrite(['teams'], list, removal)).toEqual([SAVED])
  })

  it('is settled when the server answers it as done, or no longer has the Team', () => {
    const removal = kept(deleteTeam(SAVED))
    expect(settle(removal, { status: 204 }).outcome).toBe('done')
    expect(settle(removal, { status: 404 }).outcome).toBe('done')
  })
})
