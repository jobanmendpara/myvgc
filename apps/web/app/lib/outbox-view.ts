import {
  compareRounds,
  type NoteEntryView,
  type OpponentView,
  type RoundView,
  type TournamentView,
} from '@myvgc/core/schema'
import {
  addedOpponent,
  addedTournament,
  applyToTournamentView,
  isRoundWrite,
  isTournamentWrite,
  withWrite,
} from './outbox-apply'
import { discardedWith, inOrder, type OutboxState, type OutboxWrite } from './outbox-rules'

// What the page shows of the outbox (ADR 17, DEV-167): the bar at the bottom of the screen, the
// marks on Tournaments, Rounds, Note entries and Opponents not yet synced, and the list of changes on this
// phone. Pure, so it is tested without a browser. A change a page is still saving shows as
// saving there, never here, so nothing changes for a User whose writes go straight through.

/** The pending writes the User sees as waiting on this phone: all but those a page is saving. */
export const waitingWrites = (state: OutboxState) =>
  state.pending.filter((write) => !state.saving?.includes(write.id))

const changes = (count: number) => (count === 1 ? '1 change' : `${count} changes`)

/** What the bar at the bottom of the screen says, if anything. */
export type SyncBar =
  /** The session ended: the changes wait for the User to log in again. */
  | { kind: 'login'; count: number }
  /** The server refused some changes; `waiting` more are still to be sent. */
  | { kind: 'rejected'; count: number; waiting: number }
  /** A waiting change is on its way. */
  | { kind: 'sending'; count: number }
  /** Changes kept on this phone, not yet synced. */
  | { kind: 'waiting'; count: number; online: boolean }
  /** Everything that was waiting has been sent, shown for a moment. */
  | { kind: 'sent'; count: number }

/**
 * The bar for the outbox's state. `sent` counts the waiting changes sent since the bar last
 * cleared, so it can say they all went.
 */
export function syncBar(
  state: OutboxState,
  { online, sent }: { online: boolean; sent: number },
): SyncBar | undefined {
  const waiting = waitingWrites(state)
  if (state.waitingForLogin && waiting.length) return { kind: 'login', count: waiting.length }
  if (state.rejected.length)
    return { kind: 'rejected', count: state.rejected.length, waiting: waiting.length }
  if (waiting.some((write) => write.id === state.sending))
    return { kind: 'sending', count: waiting.length }
  if (waiting.length) return { kind: 'waiting', count: waiting.length, online }
  if (sent) return { kind: 'sent', count: sent }
  return undefined
}

export function syncBarText(bar: SyncBar): { title: string; detail: string } {
  switch (bar.kind) {
    case 'login':
      return {
        title: `Log in again to send ${changes(bar.count)}`,
        detail: 'They stay on this phone until you do.',
      }
    case 'rejected':
      return {
        title: bar.count === 1 ? "1 change wasn't saved" : `${bar.count} changes weren't saved`,
        detail: `Tap to fix or discard.${bar.waiting ? ` ${bar.waiting} more waiting.` : ''}`,
      }
    case 'sending':
      return { title: `Sending ${changes(bar.count)}…`, detail: 'Keep the app open.' }
    case 'waiting':
      return {
        title: `${changes(bar.count)} saved on this phone`,
        detail: bar.online
          ? 'Not yet synced. Trying again shortly.'
          : 'Not yet synced. Sent when the signal returns.',
      }
    case 'sent':
      return {
        title: bar.count === 1 ? '1 change sent' : `All ${bar.count} changes sent`,
        detail: '',
      }
  }
}

/** How an item not yet synced is marked where it shows. */
export type MarkStatus = 'waiting' | 'sending' | 'deleting' | 'rejected'

export interface ItemMark {
  status: MarkStatus
  /** The change behind the mark, to fix or discard. */
  write: OutboxWrite
}

export const MARK_TEXT: Record<MarkStatus, string> = {
  waiting: 'Not synced',
  sending: 'Sending',
  deleting: 'Deleting when the signal returns',
  rejected: 'Not saved',
}

/** The coloured left edge of a row with a mark: amber while it waits, red once refused. */
export function syncEdge(mark: ItemMark | undefined): string {
  if (!mark) return ''
  return mark.status === 'rejected'
    ? 'shadow-[inset_3px_0_0_var(--destructive)]'
    : 'shadow-[inset_3px_0_0_oklch(76.9%_0.188_70.08)]'
}

/** How a write marks what it changes, or nothing while a page is still saving it. */
function markOf(write: OutboxWrite, state: OutboxState): MarkStatus | undefined {
  if (write.state.status === 'rejected') return 'rejected'
  if (state.saving?.includes(write.id)) return undefined
  if (write.kind.startsWith('delete-')) return 'deleting'
  return write.id === state.sending ? 'sending' : 'waiting'
}

/** Every change the User sees, in the order made: waiting ones and rejected ones. */
const shownWrites = (state: OutboxState) =>
  inOrder([...state.pending, ...state.rejected]).filter((write) => markOf(write, state))

/** The marks by the ID of what they mark. A rejected change outranks a later waiting one. */
function marksBy(
  state: OutboxState,
  keyOf: (write: OutboxWrite) => string | undefined,
): Map<string, ItemMark> {
  const marks = new Map<string, ItemMark>()
  for (const write of shownWrites(state)) {
    const key = keyOf(write)
    const status = markOf(write, state)
    if (!key || !status || marks.get(key)?.status === 'rejected') continue
    marks.set(key, { status, write })
  }
  return marks
}

export interface RoundRow {
  round: RoundView
  mark?: ItemMark
}

/**
 * A Tournament's Rounds as its list shows them: each marked while a change to it waits, plus
 * the Rounds a waiting delete still shows, struck through, and the new Rounds the server
 * refused, so nothing disappears before the server has it. Only the Rounds the page already
 * counts are in the Record.
 */
export function roundRows(tournament: TournamentView, state: OutboxState): RoundRow[] {
  const marks = marksBy(state, (write) =>
    isRoundWrite(write) && write.subject.tournamentId === tournament.id
      ? write.subject.roundId
      : undefined,
  )
  const rows: RoundRow[] = tournament.rounds.map((round) => ({ round, mark: marks.get(round.id) }))
  for (const [id, mark] of marks) {
    if (rows.some((row) => row.round.id === id)) continue
    const round =
      mark.status === 'deleting'
        ? (mark.write.subject.before as RoundView | undefined)
        : withWrite(tournament, mark.write).rounds.find((r) => r.id === id)
    if (round) rows.push({ round, mark })
  }
  return rows.sort((a, b) => compareRounds(a.round, b.round))
}

/** The rejected Round write to fix when a Round is opened, if there is one. */
export function rejectedRound(
  state: OutboxState,
  tournamentId: string,
  roundId: string,
): OutboxWrite | undefined {
  return state.rejected.findLast(
    (write) =>
      (write.kind === 'log-round' || write.kind === 'edit-round') &&
      write.subject.tournamentId === tournamentId &&
      write.subject.roundId === roundId,
  )
}

export interface NoteEntryRow {
  entry: NoteEntryView
  mark?: ItemMark
}

/** An Opponent's Note entries, marked and kept in view as {@link roundRows} does for Rounds. */
export function noteEntryRows(
  entries: NoteEntryView[],
  opponentId: string,
  state: OutboxState,
): NoteEntryRow[] {
  const marks = marksBy(state, (write) =>
    write.kind.endsWith('note-entry') && write.subject.opponentId === opponentId
      ? write.subject.noteEntryId
      : undefined,
  )
  const rows: NoteEntryRow[] = entries.map((entry) => ({ entry, mark: marks.get(entry.id) }))
  for (const [id, mark] of marks) {
    if (rows.some((row) => row.entry.id === id)) continue
    const entry =
      mark.status === 'deleting'
        ? (mark.write.subject.before as NoteEntryView | undefined)
        : mark.write.kind === 'add-note-entry'
          ? noteEntryOf(id, mark.write)
          : undefined
    if (entry) rows.push({ entry, mark })
  }
  return rows.sort(
    (a, b) =>
      b.entry.date.localeCompare(a.entry.date) ||
      b.entry.createdAt.localeCompare(a.entry.createdAt),
  )
}

function noteEntryOf(id: string, write: OutboxWrite): NoteEntryView {
  const fields = (write.request.body ?? {}) as Partial<NoteEntryView>
  return {
    id,
    date: fields.date ?? '',
    text: fields.text ?? '',
    createdAt: write.createdAt,
    updatedAt: write.createdAt,
  }
}

/** A write on an Opponent themselves: adding, changing or deleting them. */
const isOpponentWrite = (write: OutboxWrite) =>
  write.kind === 'add-opponent' ||
  write.kind === 'edit-opponent' ||
  write.kind === 'delete-opponent'

/**
 * The Opponents added, changed or deleted on this phone and not yet synced. An Opponent added
 * with a Round is marked while that Round waits; a refused Round is marked on the Round.
 */
export function opponentMarks(state: OutboxState): Map<string, ItemMark> {
  return marksBy(state, (write) =>
    isOpponentWrite(write)
      ? write.subject.opponentId
      : write.state.status === 'pending'
        ? addedOpponent(write)?.id
        : undefined,
  )
}

/**
 * The Opponents list as it shows: the Opponents a waiting delete still shows, struck through,
 * and the new Opponents the server refused, so nothing disappears before the server has it.
 */
export function opponentRows(list: OpponentView[], state: OutboxState): OpponentView[] {
  const extra: OpponentView[] = []
  for (const [id, mark] of opponentMarks(state)) {
    if (list.some((o) => o.id === id)) continue
    const opponent =
      mark.status === 'deleting'
        ? (mark.write.subject.before as OpponentView | undefined)
        : mark.status === 'rejected' && mark.write.kind === 'add-opponent'
          ? addedOpponent(mark.write)
          : undefined
    if (opponent) extra.push(opponent)
  }
  if (!extra.length) return list
  return [...list, ...extra].sort(
    (a, b) =>
      a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase()) ||
      a.id.localeCompare(b.id),
  )
}

/** The rejected new or changed Opponent to fix on their page, if there is one. */
export function rejectedOpponent(state: OutboxState, opponentId: string): OutboxWrite | undefined {
  return state.rejected.findLast(
    (write) =>
      (write.kind === 'add-opponent' || write.kind === 'edit-opponent') &&
      write.subject.opponentId === opponentId,
  )
}

/** The rejected save of the Player details to fix in their form, if there is one. */
export const rejectedPlayerDetails = (state: OutboxState) =>
  state.rejected.findLast((write) => write.kind === 'save-player-details')

/** The Tournaments created, changed or deleted on this phone and not yet synced. */
export function tournamentMarks(state: OutboxState): Map<string, ItemMark> {
  return marksBy(state, (write) =>
    isTournamentWrite(write) ? write.subject.tournamentId : undefined,
  )
}

/**
 * The Tournaments list as it shows: the Tournaments a waiting delete still shows, struck through,
 * and the new Tournaments the server refused, so nothing disappears before the server has it.
 */
export function tournamentRows(list: TournamentView[], state: OutboxState): TournamentView[] {
  const extra: TournamentView[] = []
  for (const [id, mark] of tournamentMarks(state)) {
    if (list.some((t) => t.id === id)) continue
    const tournament =
      mark.status === 'deleting'
        ? (mark.write.subject.before as TournamentView | undefined)
        : mark.status === 'rejected'
          ? addedTournament(mark.write)
          : undefined
    if (tournament) extra.push(applyToTournamentView(tournament, state.pending))
  }
  if (!extra.length) return list
  return [...list, ...extra].sort(
    (a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt),
  )
}

/** The rejected new or changed Tournament to fix when its form is opened, if there is one. */
export function rejectedTournament(
  state: OutboxState,
  tournamentId: string,
): OutboxWrite | undefined {
  return state.rejected.findLast(
    (write) =>
      (write.kind === 'add-tournament' || write.kind === 'edit-tournament') &&
      write.subject.tournamentId === tournamentId,
  )
}

/** Whether the server doesn't have this Tournament yet: its create is still on this phone. */
export const notYetCreated = (state: OutboxState, tournamentId: string) =>
  [...state.pending, ...state.rejected].some(
    (write) => write.kind === 'add-tournament' && write.subject.tournamentId === tournamentId,
  )

/** What a change is, in a few words, such as "New Round 4 in Portland Regional". */
export function changeTitle(write: OutboxWrite): string {
  if (write.kind !== 'log-round' && write.kind !== 'add-note-entry') return write.label
  // A Round whose number the server picks is "A Round in …".
  return write.label.startsWith('A ') ? `A new ${write.label.slice(2)}` : `New ${write.label}`
}

/** "a, b and c". */
const listOf = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : (items[0] ?? '')

interface SentRound {
  games?: unknown[]
  opponentTeam?: unknown[]
  newOpponentName?: string | null
  bye?: boolean
}

/** What a new Round brings with it: its Games, the Opponent's Team and a new Opponent. */
function roundParts(write: OutboxWrite) {
  const body = (write.request.body ?? {}) as SentRound
  const games = body.games?.length ?? 0
  return {
    games,
    team: !body.bye && Boolean(body.opponentTeam?.length),
    newOpponent: body.bye ? undefined : (body.newOpponentName ?? undefined),
  }
}

/** More about a change, such as "3 Games, their Opponent's Team and Sam Ortiz as a new Opponent". */
export function changeDetail(write: OutboxWrite): string {
  if (write.kind !== 'log-round') return ''
  const { games, team, newOpponent } = roundParts(write)
  return listOf([
    ...(games ? [games === 1 ? '1 Game' : `${games} Games`] : []),
    ...(team ? ['their Opponent’s Team'] : []),
    ...(newOpponent ? [`${newOpponent} as a new Opponent`] : []),
  ])
}

export interface ChangeItem {
  write: OutboxWrite
  status: MarkStatus
}

/** The changes on this phone the User sees, in the order made. */
export function changeList(state: OutboxState): ChangeItem[] {
  return shownWrites(state).map((write) => ({ write, status: markOf(write, state)! }))
}

const counted = (count: number, one: string, many: string) =>
  count === 1 ? `1 ${one}` : `${count} ${many}`

/**
 * What the dialog asks before discarding a change. `writes` are the changes on this phone, as
 * discarding a new Tournament takes the ones waiting on it along.
 */
export function discardText(
  write: OutboxWrite,
  writes: readonly OutboxWrite[] = [],
): { title: string; body: string } {
  const title = `Discard ${changeTitle(write).replace(/^(A new|New) /, 'the new ')}?`
  // The other changes waiting on a new Opponent go with them (DEV-205).
  const alongWith = (create: OutboxWrite) => {
    const along = discardedWith(writes, create).filter((w) => w.id !== create.id).length
    return along ? [`${counted(along, 'other change', 'other changes')} to them`] : []
  }
  const never = (what: string[]) =>
    `It was never saved to your account, so ${listOf(what)} ${what.length > 1 ? 'go' : 'goes'} from this phone.`
  switch (write.kind) {
    case 'log-round': {
      const { games, team, newOpponent } = roundParts(write)
      return {
        title,
        body: never([
          'the Round',
          ...(games ? ['its Games'] : []),
          ...(team ? ['the Opponent’s Team'] : []),
          ...(newOpponent ? [`the new Opponent ${newOpponent}`, ...alongWith(write)] : []),
        ]),
      }
    }
    case 'add-opponent':
      return {
        title,
        body: never([
          `the new Opponent ${write.subject.opponentName ?? ''}`.trim(),
          ...alongWith(write),
        ]),
      }
    case 'add-note-entry':
      return { title, body: never(['the Note entry']) }
    case 'add-tournament': {
      const along = discardedWith(writes, write).filter((w) => w.id !== write.id)
      const rounds = along.filter((w) => w.kind === 'log-round').length
      const others = along.length - rounds
      return {
        title,
        body: never([
          'the Tournament',
          ...(rounds ? [`the ${counted(rounds, 'Round', 'Rounds')} logged in it`] : []),
          ...(others ? [`${counted(others, 'other change', 'other changes')} to it`] : []),
        ]),
      }
    }
    default:
      return { title, body: 'The server keeps its version.' }
  }
}
