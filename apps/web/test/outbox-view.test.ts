import type { NoteEntryView, RoundView, TournamentView } from '@myvgc/core/schema'
import { describe, expect, it } from 'vitest'
import type { WriteDraft } from '../app/lib/outbox'
import { OUTBOX_FORMAT, type OutboxState, type OutboxWrite } from '../app/lib/outbox-rules'
import {
  changeDetail,
  changeList,
  changeTitle,
  discardText,
  noteEntryRows,
  opponentMarks,
  rejectedRound,
  roundRows,
  syncBar,
  syncBarText,
  waitingWrites,
} from '../app/lib/outbox-view'
import {
  addNoteEntry,
  addOpponent,
  deleteNoteEntry,
  deleteRound,
  editRound,
  logRound,
  reviseRound,
} from '../app/lib/outbox-writes'

let order = 0
/** A draft as the outbox keeps it, pending unless told otherwise. */
const kept = (draft: WriteDraft, state?: OutboxWrite['state']): OutboxWrite => ({
  ...draft,
  userId: 'u1',
  format: OUTBOX_FORMAT,
  order: ++order,
  createdAt: '2026-11-23T10:42:00.000Z',
  state: state ?? { status: 'pending', attempts: 1 },
})
const refused = (message: string, fields?: Record<string, string>) =>
  ({ status: 'rejected', message, ...(fields ? { fields } : {}) }) as const

/** The outbox state for these writes, as the outbox shows it. */
function stateOf(writes: OutboxWrite[], extra: Partial<OutboxState> = {}): OutboxState {
  return {
    pending: writes.filter((w) => w.state.status === 'pending'),
    rejected: writes.filter((w) => w.state.status === 'rejected'),
    waitingForLogin: false,
    ...extra,
  }
}

const DEV = { id: '00000000-0000-4000-8000-000000000003', displayName: 'Dev Patel' }

function round(fields: Partial<RoundView> & Pick<RoundView, 'id'>): RoundView {
  return {
    tournamentId: 't1',
    phase: 'swiss',
    roundNumber: 1,
    stage: null,
    bestOf: 3,
    bye: false,
    result: 'win',
    gameScore: null,
    opponent: DEV,
    notes: '',
    games: [],
    createdAt: '2026-11-22T09:00:00.000Z',
    updatedAt: '2026-11-22T09:00:00.000Z',
    ...fields,
  }
}

const tournament = (rounds: RoundView[]) =>
  ({
    id: 't1',
    name: 'Portland Regional',
    defaultBestOf: 3,
    rounds,
    opponentTeams: [],
    opponentAgeDivisions: [],
    record: { swiss: { wins: 0, losses: 0, ties: 0 }, topCut: { wins: 0, losses: 0, ties: 0 } },
  }) as unknown as TournamentView

const r3 = round({ id: 'r3', roundNumber: 3 })
const portland = tournament([round({ id: 'r1' }), round({ id: 'r2', roundNumber: 2 }), r3])
const OPPONENT_TEAM = [{ species: 'incineroar' }, { species: 'rillaboom' }] as never
const GAME = {
  number: 1,
  brought: [],
  leads: [],
  opponentBrought: [],
  opponentLeads: [],
  result: 'win',
  notes: '',
} as const

/** A new Round 4 against a new Opponent, Sam Ortiz, with a Game and their Opponent's Team. */
const round4 = (state?: OutboxWrite['state']) =>
  kept(
    logRound(
      portland,
      {
        phase: 'swiss',
        roundNumber: 4,
        result: 'win',
        newOpponentName: 'Sam Ortiz',
        notes: '',
        games: [GAME],
        opponentTeam: OPPONENT_TEAM,
      } as never,
      'Sam Ortiz',
    ),
    state,
  )

describe('The bar at the bottom of the screen', () => {
  it('shows nothing for a User whose writes all go straight through', () => {
    expect(syncBar(stateOf([]), { online: true, sent: 0 })).toBeUndefined()
    // A page still saving a change shows it as saving, not as kept on this phone.
    const saving = round4({ status: 'pending', attempts: 0 })
    const state = stateOf([saving], { saving: [saving.id], sending: saving.id })
    expect(waitingWrites(state)).toEqual([])
    expect(syncBar(state, { online: true, sent: 0 })).toBeUndefined()
  })

  it('counts the changes waiting on this phone, a new Round with its new Opponent as one', () => {
    const state = stateOf([round4(), kept(editRound(portland, r3, { notes: 'x' } as never, null))])
    const offline = syncBar(state, { online: false, sent: 0 })
    expect(offline).toEqual({ kind: 'waiting', count: 2, online: false })
    expect(syncBarText(offline!)).toEqual({
      title: '2 changes saved on this phone',
      detail: 'Not yet synced. Sent when the signal returns.',
    })
    expect(syncBarText(syncBar(state, { online: true, sent: 0 })!).detail).toBe(
      'Not yet synced. Trying again shortly.',
    )
  })

  it('says it is sending while a waiting change is on its way', () => {
    const write = round4()
    const bar = syncBar(stateOf([write], { sending: write.id }), { online: true, sent: 0 })
    expect(bar).toEqual({ kind: 'sending', count: 1 })
    expect(syncBarText(bar!).title).toBe('Sending 1 change…')
  })

  it('turns red for a rejected change, saying how many more wait', () => {
    const state = stateOf([
      round4(refused('Round 4 is already logged.')),
      kept(addOpponent('Kai Tanaka')),
    ])
    const bar = syncBar(state, { online: true, sent: 0 })
    expect(bar).toEqual({ kind: 'rejected', count: 1, waiting: 1 })
    expect(syncBarText(bar!)).toEqual({
      title: "1 change wasn't saved",
      detail: 'Tap to fix or discard. 1 more waiting.',
    })
  })

  it('asks for a login when the session has ended, before anything else', () => {
    const state = stateOf([round4(), kept(addOpponent('Kai Tanaka'), refused('No.'))], {
      waitingForLogin: true,
    })
    const bar = syncBar(state, { online: true, sent: 0 })
    expect(bar).toEqual({ kind: 'login', count: 1 })
    expect(syncBarText(bar!).title).toBe('Log in again to send 1 change')
  })

  it('turns green once everything waiting has been sent', () => {
    expect(syncBar(stateOf([]), { online: true, sent: 3 })).toEqual({ kind: 'sent', count: 3 })
    expect(syncBarText({ kind: 'sent', count: 3 }).title).toBe('All 3 changes sent')
  })
})

describe('Marks on the Rounds of a Tournament', () => {
  it('leaves Rounds the server has plain', () => {
    expect(roundRows(portland, stateOf([])).map((row) => row.mark)).toEqual([
      undefined,
      undefined,
      undefined,
    ])
  })

  it('marks a Round waiting on this phone, and one on its way', () => {
    const edit = kept(editRound(portland, r3, { notes: 'Sleep Powder' } as never, null))
    const rows = roundRows(portland, stateOf([edit]))
    expect(rows.find((row) => row.round.id === 'r3')?.mark?.status).toBe('waiting')
    const sending = roundRows(portland, stateOf([edit], { sending: edit.id }))
    expect(sending.find((row) => row.round.id === 'r3')?.mark?.status).toBe('sending')
  })

  it('keeps a Round deleted on this phone in view, struck through, until the server has it', () => {
    const removal = kept(deleteRound(portland, r3))
    const withoutIt = tournament(portland.rounds.filter((r) => r.id !== 'r3'))
    const rows = roundRows(withoutIt, stateOf([removal]))
    expect(rows.map((row) => [row.round.roundNumber, row.mark?.status])).toEqual([
      [1, undefined],
      [2, undefined],
      [3, 'deleting'],
    ])
  })

  it('keeps a rejected new Round in view, with the server’s message, outside the Record', () => {
    const write = round4(refused('Round 4 is already logged.', { roundNumber: 'Round 4 is…' }))
    const rows = roundRows(portland, stateOf([write]))
    expect(rows.at(-1)).toMatchObject({
      round: { id: write.subject.roundId, roundNumber: 4, opponent: { displayName: 'Sam Ortiz' } },
      mark: { status: 'rejected', write },
    })
  })

  it('finds the rejected change to fix when a Round is opened', () => {
    const write = round4(refused('Round 4 is already logged.'))
    const state = stateOf([write])
    expect(rejectedRound(state, 't1', write.subject.roundId!)).toBe(write)
    expect(rejectedRound(state, 't1', 'r3')).toBeUndefined()
  })
})

describe('Marks on an Opponent’s Note entries and the Opponents list', () => {
  const SAM = { id: '00000000-0000-4000-8000-000000000009', displayName: 'Sam Ortiz' }
  const entry: NoteEntryView = {
    id: 'n0',
    date: '2026-11-09',
    text: 'Trick Room mode.',
    createdAt: '2026-11-09T10:00:00.000Z',
    updatedAt: '2026-11-09T10:00:00.000Z',
  }

  it('marks a new Note entry and keeps a deleted one in view', () => {
    const added = kept(addNoteEntry(SAM, { date: '2026-11-23', text: 'Leads Sneasler.' }))
    const removal = kept(deleteNoteEntry(SAM, entry))
    const shown = [
      {
        id: added.subject.noteEntryId!,
        date: '2026-11-23',
        text: 'Leads Sneasler.',
        createdAt: added.createdAt,
        updatedAt: added.createdAt,
      },
    ]
    const rows = noteEntryRows(shown, SAM.id, stateOf([added, removal]))
    expect(rows.map((row) => [row.entry.text, row.mark?.status])).toEqual([
      ['Leads Sneasler.', 'waiting'],
      ['Trick Room mode.', 'deleting'],
    ])
  })

  it('keeps a rejected new Note entry in view with its message', () => {
    const added = kept(
      addNoteEntry(SAM, { date: '2026-11-23', text: 'Leads Sneasler.' }),
      refused('Too long.'),
    )
    expect(noteEntryRows([entry], SAM.id, stateOf([added]))).toMatchObject([
      { entry: { text: 'Leads Sneasler.' }, mark: { status: 'rejected' } },
      { entry: { id: 'n0' } },
    ])
  })

  it('marks an Opponent added on this phone, on their own or with a Round', () => {
    const alone = kept(addOpponent('Kai Tanaka'))
    const withRound = round4()
    const marks = opponentMarks(stateOf([alone, withRound]))
    expect(marks.get(alone.subject.opponentId!)?.status).toBe('waiting')
    const body = withRound.request.body as { newOpponentId: string }
    expect(marks.get(body.newOpponentId)?.status).toBe('waiting')
  })
})

describe('The list of changes on this phone', () => {
  it('names each change, saying what a new Round brings with it', () => {
    const write = round4()
    expect(changeTitle(write)).toBe('New Round 4 in Portland Regional')
    expect(changeDetail(write)).toBe(
      '1 Game, their Opponent’s Team and Sam Ortiz as a new Opponent',
    )
    const numberless = kept(logRound(portland, { phase: 'swiss', result: 'win' } as never, null))
    expect(changeTitle(numberless)).toBe('A new Round in Portland Regional')
    expect(discardText(numberless).title).toBe('Discard the new Round in Portland Regional?')
    expect(changeTitle(kept(deleteRound(portland, r3)))).toBe(
      'Deleting Round 3 in Portland Regional',
    )
  })

  it('lists waiting and rejected changes in the order they were made', () => {
    const first = round4(refused('No.'))
    const second = kept(addOpponent('Kai Tanaka'))
    expect(
      changeList(stateOf([first, second])).map((item) => [item.write.id, item.status]),
    ).toEqual([
      [first.id, 'rejected'],
      [second.id, 'waiting'],
    ])
  })

  it('says what discarding a new Round takes with it', () => {
    expect(discardText(round4(refused('No.')))).toEqual({
      title: 'Discard the new Round 4 in Portland Regional?',
      body: 'It was never saved to your account, so the Round, its Games, the Opponent’s Team and the new Opponent Sam Ortiz go from this phone.',
    })
  })

  it('says the server keeps its version when discarding an edit', () => {
    const edit = kept(
      editRound(portland, r3, { phase: 'swiss', roundNumber: 3, notes: 'x' } as never, null),
      refused('No.'),
    )
    expect(discardText(edit)).toEqual({
      title: 'Discard Round 3 in Portland Regional?',
      body: 'The server keeps its version.',
    })
  })
})

describe('Fixing a rejected Round', () => {
  it('keeps the Round’s ID and still adds the new Opponent the server never got', () => {
    const write = round4(refused('Round 4 is already logged.'))
    const original = write.request.body as {
      id: string
      newOpponentId: string
      opponentTeam: unknown
    }
    // The form shows the new Opponent as chosen, and leaves out their Team as unchanged.
    const fix = reviseRound(
      write,
      portland,
      {
        phase: 'swiss',
        roundNumber: 5,
        result: 'win',
        opponentId: original.newOpponentId,
        newOpponentName: null,
        notes: '',
        games: [GAME],
      } as never,
      'Sam Ortiz',
    )
    expect(fix.label).toBe('Round 5 in Portland Regional')
    expect(fix.request).toMatchObject({
      method: 'POST',
      url: '/api/tournaments/t1/rounds',
      body: {
        id: original.id,
        roundNumber: 5,
        opponentId: null,
        newOpponentName: 'Sam Ortiz',
        newOpponentId: original.newOpponentId,
        opponentTeam: original.opponentTeam,
      },
    })
    expect(fix.subject?.roundId).toBe(original.id)
  })
})
