import type {
  NoteEntryView,
  OpponentDetailView,
  OpponentView,
  RoundView,
  TournamentView,
} from '@myvgc/core/schema'
import { describe, expect, it } from 'vitest'
import type { WriteDraft } from '../app/lib/outbox'
import { applyPending, revertWrite } from '../app/lib/outbox-apply'
import { OUTBOX_FORMAT, type OutboxWrite } from '../app/lib/outbox-rules'
import {
  addNoteEntry,
  addOpponent,
  deleteNoteEntry,
  deleteRound,
  editNoteEntry,
  editRound,
  logRound,
  roundProblems,
} from '../app/lib/outbox-writes'

let order = 0
/** A draft as the outbox keeps it. */
const kept = (draft: WriteDraft): OutboxWrite => ({
  ...draft,
  userId: 'u1',
  format: OUTBOX_FORMAT,
  order: ++order,
  createdAt: `2026-11-23T10:00:0${order % 10}.000Z`,
  state: { status: 'pending', attempts: 0 },
})

const WOLFE = { id: '00000000-0000-4000-8000-000000000001', displayName: 'Wolfe Glick' }

function round(fields: Partial<RoundView> & Pick<RoundView, 'id'>): RoundView {
  return {
    tournamentId: 't1',
    phase: 'swiss',
    roundNumber: 1,
    stage: null,
    bestOf: 1,
    bye: false,
    result: 'win',
    gameScore: null,
    opponent: WOLFE,
    notes: '',
    games: [],
    createdAt: '2026-11-23T09:00:00.000Z',
    updatedAt: '2026-11-23T09:00:00.000Z',
    ...fields,
  }
}

const tournament = (rounds: RoundView[]) =>
  ({
    id: 't1',
    name: 'Worlds',
    defaultBestOf: 1,
    rounds,
    opponentTeams: [],
    opponentAgeDivisions: [],
    record: { swiss: { wins: 0, losses: 0, ties: 0 }, topCut: { wins: 0, losses: 0, ties: 0 } },
  }) as unknown as TournamentView

const KEY = ['tournament', 't1']

describe('A Round logged on the phone', () => {
  const one = round({ id: 'r1' })
  const logged = kept(
    logRound(
      tournament([one]),
      { phase: 'swiss', result: 'loss', opponentId: WOLFE.id, notes: 'Close' },
      WOLFE.displayName,
    ),
  )

  it('shows at once, with the next free number and the Record updated', () => {
    const after = applyPending(KEY, tournament([one]), [logged]) as TournamentView
    expect(after.rounds.map((r) => [r.roundNumber, r.result, r.opponent?.displayName])).toEqual([
      [1, 'win', 'Wolfe Glick'],
      [2, 'loss', 'Wolfe Glick'],
    ])
    expect(after.record.swiss).toEqual({ wins: 1, losses: 1, ties: 0 })
  })

  it('changes nothing more when applied again over its own result', () => {
    const once = applyPending(KEY, tournament([one]), [logged])
    expect(applyPending(KEY, once, [logged])).toEqual(once)
  })

  it('is also in the Tournaments list', () => {
    const [after] = applyPending(['tournaments'], [tournament([one])], [logged]) as TournamentView[]
    expect(after!.record.swiss.losses).toBe(1)
  })

  it('is taken back out when it is discarded or rejected', () => {
    const once = applyPending(KEY, tournament([one]), [logged])
    const back = revertWrite(KEY, once, logged) as TournamentView
    expect(back.rounds.map((r) => r.id)).toEqual(['r1'])
    expect(back.record.swiss).toEqual({ wins: 1, losses: 0, ties: 0 })
  })

  it('leaves out a rejected write', () => {
    const rejected = { ...logged, state: { status: 'rejected', message: 'No' } } as const
    expect(applyPending(KEY, tournament([one]), [rejected])).toEqual(tournament([one]))
  })

  it('adds a new Opponent to the Opponents list, which their page can open', () => {
    const withNew = kept(
      logRound(
        tournament([]),
        { phase: 'swiss', result: 'win', newOpponentName: 'Aaron Zheng' },
        null,
      ),
    )
    const list = applyPending(['opponents', 'list'], [], [withNew]) as OpponentView[]
    expect(list.map((o) => o.displayName)).toEqual(['Aaron Zheng'])
    const [added] = list
    const after = applyPending(KEY, tournament([]), [withNew]) as TournamentView
    expect(after.rounds[0]!.opponent).toEqual({ id: added!.id, displayName: 'Aaron Zheng' })
  })
})

describe('A Round changed or deleted on the phone', () => {
  const one = round({ id: 'r1' })
  const two = round({ id: 'r2', roundNumber: 2, result: 'loss' })

  it('an edit replaces the Round, and discarding it puts the Round back', () => {
    const edit = kept(
      editRound(
        tournament([one, two]),
        two,
        { phase: 'swiss', roundNumber: 2, result: 'win', opponentId: WOLFE.id },
        WOLFE.displayName,
      ),
    )
    const after = applyPending(KEY, tournament([one, two]), [edit]) as TournamentView
    expect(after.record.swiss).toEqual({ wins: 2, losses: 0, ties: 0 })
    const back = revertWrite(KEY, after, edit) as TournamentView
    expect(back.rounds).toEqual([one, two])
  })

  it('a delete removes the Round, and its Opponent’s Team once no Round is against them', () => {
    const start = {
      ...tournament([one]),
      opponentTeams: [{ opponentId: WOLFE.id, pokemon: [] }],
    } as TournamentView
    const del = kept(deleteRound(start, one))
    const after = applyPending(KEY, start, [del]) as TournamentView
    expect(after.rounds).toEqual([])
    expect(after.opponentTeams).toEqual([])
    expect((revertWrite(KEY, after, del) as TournamentView).rounds).toEqual([one])
  })
})

describe('Opponents and Note entries added on the phone', () => {
  const entry: NoteEntryView = {
    id: 'n1',
    date: '2026-11-01',
    text: 'Leads Incineroar',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  }

  it('a new Opponent gets a page of their own, with Note entries added there', () => {
    const add = kept(addOpponent('Aaron Zheng'))
    const id = add.subject.opponentId!
    const note = kept(
      addNoteEntry({ id, displayName: 'Aaron Zheng' }, { date: '2026-11-23', text: 'Hi' }),
    )
    const page = applyPending(['opponents', 'detail', id], undefined, [
      add,
      note,
    ]) as OpponentDetailView
    expect(page.displayName).toBe('Aaron Zheng')
    expect(page.noteEntries.map((e) => e.text)).toEqual(['Hi'])
  })

  it('Note entries are added, changed and deleted, newest first', () => {
    const detail = {
      ...WOLFE,
      noteEntries: [entry],
      rounds: [],
      opponentTeams: [],
      opponentAgeDivisions: [],
    } as unknown as OpponentDetailView
    const key = ['opponents', 'detail', WOLFE.id]
    const add = kept(addNoteEntry(WOLFE, { date: '2026-11-23', text: 'Newer' }))
    const edit = kept(editNoteEntry(WOLFE, entry, { date: '2026-11-01', text: 'Leads Amoonguss' }))
    const after = applyPending(key, detail, [add, edit]) as OpponentDetailView
    expect(after.noteEntries.map((e) => e.text)).toEqual(['Newer', 'Leads Amoonguss'])

    const del = kept(deleteNoteEntry(WOLFE, entry))
    const gone = applyPending(key, after, [del]) as OpponentDetailView
    expect(gone.noteEntries.map((e) => e.text)).toEqual(['Newer'])
    const back = revertWrite(key, gone, del) as OpponentDetailView
    expect(back.noteEntries.map((e) => e.text)).toEqual(['Newer', 'Leads Incineroar'])
  })
})

describe('Checking a Round on the phone before it is kept', () => {
  const one = round({ id: 'r1' })

  it('finds what the server would refuse, against the field', () => {
    expect(roundProblems(tournament([one]), { phase: 'swiss', opponentId: WOLFE.id })).toEqual({
      result: 'Choose Win, Loss or Tie.',
    })
    expect(
      roundProblems(tournament([one]), {
        phase: 'swiss',
        roundNumber: 1,
        result: 'win',
        opponentId: WOLFE.id,
      }),
    ).toEqual({ roundNumber: 'Round 1 is already logged.' })
  })

  it('passes a Round that looks right, including one changed in place', () => {
    const fine = { phase: 'swiss', roundNumber: 1, result: 'win', opponentId: WOLFE.id } as const
    expect(roundProblems(tournament([one]), fine, 'r1')).toBeUndefined()
    expect(roundProblems(tournament([one]), { ...fine, roundNumber: undefined })).toBeUndefined()
  })
})
