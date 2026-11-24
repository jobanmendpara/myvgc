import type {
  ListStyles,
  OpponentDetailView,
  OpponentView,
  PlayerDetails,
  TournamentView,
} from '@myvgc/core/schema'
import { describe, expect, it } from 'vitest'
import type { WriteDraft } from '../app/lib/outbox'
import { applyPending, revertWrite } from '../app/lib/outbox-apply'
import {
  discardedWith,
  nextWrite,
  OUTBOX_FORMAT,
  type OutboxState,
  type OutboxWrite,
} from '../app/lib/outbox-rules'
import {
  changeList,
  discardText,
  opponentMarks,
  opponentRows,
  rejectedOpponent,
  rejectedPlayerDetails,
} from '../app/lib/outbox-view'
import {
  addNoteEntry,
  addOpponent,
  deleteOpponent,
  editOpponent,
  logRound,
  reviseOpponent,
  reviseRound,
  saveListStyles,
  savePlayerDetails,
} from '../app/lib/outbox-writes'

// Changing and deleting an Opponent, and changing account settings, with no signal (DEV-205).

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

function opponent(id: string, displayName: string, fields: Partial<OpponentView> = {}) {
  return {
    id,
    displayName,
    aliases: [],
    notes: '',
    headToHead: { wins: 0, losses: 0, ties: 0 },
    roundCount: 0,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...fields,
  } satisfies OpponentView
}
const WOLFE = opponent('00000000-0000-4000-8000-000000000001', 'Wolfe Glick')
const AARON = opponent('00000000-0000-4000-8000-000000000002', 'Aaron Zheng', {
  aliases: ['Cybertron'],
})
const detailOf = (o: OpponentView): OpponentDetailView => ({
  ...o,
  rounds: [],
  noteEntries: [],
  opponentTeams: [],
  opponentAgeDivisions: [],
})
const LIST = ['opponents', 'list']
const changes = (displayName: string, aliases: string[] = [], notes = '') => ({
  displayName,
  aliases,
  notes,
})

const TOURNAMENT = {
  id: '00000000-0000-4000-8000-0000000000aa',
  name: 'Portland Regional',
  defaultBestOf: 3,
  rounds: [],
} as unknown as TournamentView

describe('Writes on an Opponent go in series', () => {
  it('a change to a new Opponent waits for their create, also while it is refused', () => {
    const add = kept(addOpponent('Kai Tanaka'))
    const kai = opponent(add.subject.opponentId!, 'Kai Tanaka')
    const edit = kept(editOpponent(kai, changes('Kai T.')))
    const other = kept(editOpponent(WOLFE, changes('Wolfe')))
    expect(nextWrite([add, edit, other])?.id).toBe(add.id)
    expect(nextWrite([add, edit, other], new Set([add.id]))?.id).toBe(other.id)

    const refusedAdd = { ...add, state: refused('Too long.') }
    expect(nextWrite([refusedAdd, edit, other])?.id).toBe(other.id)
  })

  it('a change to an Opponent added with a Round waits for that Round, also once refused', () => {
    const round = kept(
      logRound(
        TOURNAMENT,
        { phase: 'swiss', result: 'win', newOpponentName: 'Sam Ortiz', games: [] } as never,
        null,
      ),
    )
    const samId = (round.request.body as { newOpponentId: string }).newOpponentId
    const edit = kept(editOpponent(opponent(samId, 'Sam Ortiz'), changes('Samuel Ortiz')))
    expect(nextWrite([round, edit])?.id).toBe(round.id)
    expect(nextWrite([{ ...round, state: refused('Round 1 is already logged.') }, edit])).toBe(
      undefined,
    )
  })

  it('a Round fixed to drop its new Opponent no longer creates them', () => {
    const round = kept(
      logRound(
        TOURNAMENT,
        { phase: 'swiss', result: 'win', newOpponentName: 'Sam Ortiz', games: [] } as never,
        null,
      ),
      refused('No.'),
    )
    const fix = reviseRound(
      round,
      TOURNAMENT,
      { phase: 'swiss', result: 'win', opponentId: WOLFE.id, games: [] } as never,
      'Wolfe Glick',
    )
    expect('creates' in fix).toBe(true)
    expect(fix.creates).toBeUndefined()
  })

  it('discarding a new Opponent takes the changes waiting on them along', () => {
    const add = kept(addOpponent('Kai Tanaka'), refused('No.'))
    const kai = opponent(add.subject.opponentId!, 'Kai Tanaka')
    const edit = kept(editOpponent(kai, changes('Kai T.')))
    const note = kept(addNoteEntry(kai, { date: '2026-11-24', text: 'Leads Sneasler.' }))
    const other = kept(editOpponent(WOLFE, changes('Wolfe')))
    const all = [add, edit, note, other]
    expect(discardedWith(all, add).map((w) => w.id)).toEqual([add.id, edit.id, note.id])
    expect(discardText(add, all)).toEqual({
      title: 'Discard the new Opponent Kai Tanaka?',
      body: 'It was never saved to your account, so the new Opponent Kai Tanaka and 2 other changes to them go from this phone.',
    })
  })
})

describe('An Opponent changed or deleted on the phone', () => {
  it('shows changed at once in the list, their page and the Round form’s suggestions', () => {
    const edit = kept(editOpponent(WOLFE, changes(' Wolfe ', ['WolfeyVGC', 'wolfeyvgc'], 'Hi')))
    const list = applyPending(LIST, [AARON, WOLFE], [edit]) as OpponentView[]
    expect(list.map((o) => [o.displayName, o.aliases])).toEqual([
      ['Aaron Zheng', ['Cybertron']],
      ['Wolfe', ['WolfeyVGC']],
    ])
    const page = applyPending(['opponents', 'detail', WOLFE.id], detailOf(WOLFE), [
      edit,
    ]) as OpponentDetailView
    expect([page.displayName, page.notes]).toEqual(['Wolfe', 'Hi'])
    const suggestions = applyPending(['opponents', 'suggestions', 'wol', 8], [WOLFE], [edit])
    expect((suggestions as OpponentView[])[0]!.displayName).toBe('Wolfe')
  })

  it('goes back as it was when the change is discarded', () => {
    const edit = kept(editOpponent(WOLFE, changes('Wolfe')))
    const list = applyPending(LIST, [WOLFE], [edit]) as OpponentView[]
    expect((revertWrite(LIST, list, edit) as OpponentView[])[0]!.displayName).toBe('Wolfe Glick')
    const key = ['opponents', 'detail', WOLFE.id]
    const page = applyPending(key, detailOf(WOLFE), [edit])
    expect((revertWrite(key, page, edit) as OpponentDetailView).displayName).toBe('Wolfe Glick')
  })

  it('leaves the list and suggestions once deleted, and comes back if the delete is discarded', () => {
    const removal = kept(deleteOpponent(WOLFE))
    const list = applyPending(LIST, [AARON, WOLFE], [removal]) as OpponentView[]
    expect(list.map((o) => o.id)).toEqual([AARON.id])
    expect(applyPending(['opponents', 'suggestions', '', 8], [WOLFE], [removal])).toEqual([])
    expect((revertWrite(LIST, list, removal) as OpponentView[]).map((o) => o.id)).toEqual([
      AARON.id,
      WOLFE.id,
    ])
  })

  it('stays in view, struck through as being deleted, until the server has it', () => {
    const removal = kept(deleteOpponent(WOLFE))
    const state = stateOf([removal])
    const list = applyPending(LIST, [AARON, WOLFE], [removal]) as OpponentView[]
    const rows = opponentRows(list, state)
    expect(rows.map((o) => o.id)).toEqual([AARON.id, WOLFE.id])
    expect(opponentMarks(state).get(WOLFE.id)?.status).toBe('deleting')
    expect(changeList(state).map((item) => item.write.label)).toEqual(['Deleting Wolfe Glick'])
  })

  it('a refused change is marked, kept to fix, and the fix keeps a new Opponent’s ID', () => {
    const edit = kept(editOpponent(WOLFE, changes('')), refused('Give the Opponent a name.'))
    const add = kept(addOpponent('Kai Tanaka'), refused('No.'))
    const state = stateOf([edit, add])
    expect(opponentMarks(state).get(WOLFE.id)?.status).toBe('rejected')
    expect(rejectedOpponent(state, WOLFE.id)?.id).toBe(edit.id)
    // A refused new Opponent stays in the list and keeps a page, so it can be fixed.
    const kaiId = add.subject.opponentId!
    expect(opponentRows([WOLFE], state).map((o) => o.displayName)).toEqual([
      'Kai Tanaka',
      'Wolfe Glick',
    ])
    expect(applyPending(['opponents', 'detail', kaiId], undefined, [add])).toMatchObject({
      displayName: 'Kai Tanaka',
    })

    const fix = reviseOpponent(add, changes('Kai', ['KT']))
    expect(fix.request?.body).toEqual({ id: kaiId, displayName: 'Kai', aliases: ['KT'], notes: '' })
    expect(fix.label).toBe('New Opponent Kai')
    expect(reviseOpponent(edit, changes('Wolfe')).request).toMatchObject({
      method: 'PATCH',
      body: { displayName: 'Wolfe' },
    })
  })
})

describe('Account settings changed on the phone', () => {
  const STYLES: ListStyles = { tournaments: 'compact', teams: 'compact', opponents: 'compact' }
  const DETAILS = {
    playerName: 'Ash',
    trainerName: '',
    switchProfileName: '',
    playerId: '',
    supportId: '',
    ageDivision: null,
    dateOfBirth: null,
  } satisfies PlayerDetails

  it('the latest List styles show at once, and the saved ones come back on discard', () => {
    const key = ['account', 'list-styles']
    const first = kept(saveListStyles({ ...STYLES, opponents: 'grouped' }, STYLES))
    const second = kept(saveListStyles({ ...STYLES, opponents: 'detailed' }, STYLES))
    expect(applyPending(key, STYLES, [first, second])).toEqual({
      ...STYLES,
      opponents: 'detailed',
    })
    expect(revertWrite(key, { ...STYLES, opponents: 'grouped' }, first)).toEqual(STYLES)
    // Saves of one setting go in series.
    expect(nextWrite([first, second])?.id).toBe(first.id)
  })

  it('Player details show at once; a refused save is kept to fix', () => {
    const key = ['account', 'player-details']
    const save = kept(savePlayerDetails({ ...DETAILS, playerName: 'Ash K.' }, DETAILS))
    expect(applyPending(key, DETAILS, [save])).toMatchObject({ playerName: 'Ash K.' })
    expect(applyPending(['account', 'list-styles'], STYLES, [save])).toBe(STYLES)
    const turnedDown = { ...save, state: refused('No.', { dateOfBirth: 'Not a date.' }) }
    expect(applyPending(key, DETAILS, [turnedDown])).toBe(DETAILS)
    expect(rejectedPlayerDetails(stateOf([turnedDown]))?.id).toBe(save.id)
    expect(discardText(turnedDown).body).toBe('The server keeps its version.')
  })
})
