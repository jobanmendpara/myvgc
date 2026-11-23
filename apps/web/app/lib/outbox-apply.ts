import {
  compareRounds,
  type NoteEntryView,
  type OpponentDetailView,
  type OpponentView,
  type PokemonBuild,
  recordOf,
  roundInputSchema,
  roundResult,
  type RoundView,
  settleRound,
  type TournamentView,
} from '@myvgc/core/schema'
import type { OutboxWrite } from './outbox-rules'

// What pending writes change on the pages before the server has them (ADR 17): the Tournament,
// its Rounds and Record, the Tournaments list, the Opponents list and an Opponent's Note entries.
// Applying a write twice changes nothing more, so pending writes are applied again over each
// answer from the server until they are sent. The server's answer replaces it all once they are.

const isPending = (write: OutboxWrite) => write.state.status === 'pending'

function standing(tournament: TournamentView, rounds: RoundView[]): TournamentView {
  const sorted = rounds.toSorted(compareRounds)
  return { ...tournament, rounds: sorted, record: recordOf(sorted) }
}

/** The Round a log or edit makes, or nothing when its body can't be read. */
function roundFrom(
  tournament: TournamentView,
  write: OutboxWrite,
  existing: RoundView | undefined,
): { round: RoundView; opponentTeam?: PokemonBuild[]; ageDivision?: string | null } | undefined {
  const parsed = roundInputSchema.safeParse(write.request.body)
  if (!parsed.success) return undefined
  const input = parsed.data
  const id = write.subject.roundId!
  const others = tournament.rounds.filter((r) => r.id !== id)
  const nextNumber = Math.max(0, ...others.map((r) => r.roundNumber ?? 0)) + 1
  const roundNumber =
    input.phase === 'swiss' ? (input.roundNumber ?? existing?.roundNumber ?? nextNumber) : null
  const opponentId = input.bye ? null : (input.opponentId ?? write.subject.opponentId ?? null)
  const games = input.games.toSorted((a, b) => a.number - b.number)
  const settled = settleRound({
    phase: input.phase,
    roundNumber,
    stage: input.stage ?? null,
    bestOf: input.bestOf ?? existing?.bestOf ?? tournament.defaultBestOf,
    bye: input.bye,
    result: input.result ?? null,
    gameScore: input.gameScore ?? null,
    hasOpponent: Boolean(opponentId),
    games,
    hasOpponentTeam: false,
    hasOpponentAgeDivision: false,
  })
  const displayName =
    write.subject.opponentName ??
    input.newOpponentName ??
    (existing?.opponent?.id === opponentId ? existing.opponent.displayName : undefined) ??
    tournament.rounds.find((r) => r.opponent?.id === opponentId)?.opponent?.displayName ??
    ''
  return {
    round: {
      id,
      tournamentId: tournament.id,
      phase: settled.phase,
      roundNumber: settled.roundNumber,
      stage: settled.stage,
      bestOf: settled.bestOf,
      bye: settled.bye,
      result: roundResult(settled),
      gameScore: settled.gameScore,
      opponent: opponentId ? { id: opponentId, displayName } : null,
      notes: input.notes,
      games,
      createdAt: existing?.createdAt ?? write.createdAt,
      updatedAt: write.createdAt,
    },
    ...(input.opponentTeam !== undefined ? { opponentTeam: input.opponentTeam } : {}),
    ...(input.opponentAgeDivision !== undefined ? { ageDivision: input.opponentAgeDivision } : {}),
  }
}

/** Drops an Opponent's Team and Age Division here once no Round is against them (ADR 22, 30). */
function dropUnplayed(tournament: TournamentView, opponentId: string | undefined): TournamentView {
  if (!opponentId || tournament.rounds.some((r) => r.opponent?.id === opponentId)) return tournament
  return {
    ...tournament,
    opponentTeams: tournament.opponentTeams.filter((t) => t.opponentId !== opponentId),
    opponentAgeDivisions: tournament.opponentAgeDivisions.filter(
      (d) => d.opponentId !== opponentId,
    ),
  }
}

function applyToTournament(tournament: TournamentView, write: OutboxWrite): TournamentView {
  const id = write.subject.roundId
  const existing = tournament.rounds.find((r) => r.id === id)
  if (write.kind === 'delete-round') {
    if (!existing) return tournament
    const after = standing(
      tournament,
      tournament.rounds.filter((r) => r.id !== id),
    )
    return dropUnplayed(after, existing.opponent?.id)
  }
  const made = roundFrom(tournament, write, existing)
  if (!made) return tournament
  const { round, opponentTeam, ageDivision } = made
  let after = standing(tournament, [...tournament.rounds.filter((r) => r.id !== id), round])
  const opponentId = round.opponent?.id
  if (opponentId && opponentTeam !== undefined) {
    const others = after.opponentTeams.filter((t) => t.opponentId !== opponentId)
    after = {
      ...after,
      opponentTeams: opponentTeam.length
        ? [...others, { opponentId, pokemon: opponentTeam }]
        : others,
    }
  }
  if (opponentId && ageDivision !== undefined) {
    const others = after.opponentAgeDivisions.filter((d) => d.opponentId !== opponentId)
    after = {
      ...after,
      opponentAgeDivisions: ageDivision
        ? [
            ...others,
            {
              opponentId,
              ageDivision: ageDivision as TournamentView['opponentAgeDivisions'][0]['ageDivision'],
            },
          ]
        : others,
    }
  }
  return dropUnplayed(after, existing?.opponent?.id)
}

const isRoundWrite = (write: OutboxWrite) =>
  write.kind === 'log-round' || write.kind === 'edit-round' || write.kind === 'delete-round'

/** A Tournament with the pending writes on its Rounds applied. */
export function applyToTournamentView(
  tournament: TournamentView,
  writes: readonly OutboxWrite[],
): TournamentView {
  if (!Array.isArray(tournament.rounds)) return tournament
  return writes
    .filter((w) => isPending(w) && isRoundWrite(w) && w.subject.tournamentId === tournament.id)
    .reduce(applyToTournament, tournament)
}

/** A Tournament with a write that won't be sent taken back out, as far as it can be. */
function revertInTournament(tournament: TournamentView, write: OutboxWrite): TournamentView {
  if (!isRoundWrite(write) || write.subject.tournamentId !== tournament.id) return tournament
  if (!Array.isArray(tournament.rounds)) return tournament
  const id = write.subject.roundId
  const before = write.subject.before as RoundView | undefined
  const others = tournament.rounds.filter((r) => r.id !== id)
  return standing(tournament, before ? [...others, before] : others)
}

/** A new Opponent, as the Opponents list shows one the server doesn't have yet. */
function newOpponent(id: string, displayName: string, createdAt: string): OpponentView {
  return {
    id,
    displayName,
    aliases: [],
    notes: '',
    headToHead: { wins: 0, losses: 0, ties: 0 },
    roundCount: 0,
    createdAt,
    updatedAt: createdAt,
  }
}

/** The Opponent a write adds, either on its own or with a Round. */
function addedOpponent(write: OutboxWrite): OpponentView | undefined {
  const body = (write.request.body ?? {}) as {
    id?: string
    displayName?: string
    newOpponentId?: string
    newOpponentName?: string | null
    bye?: boolean
  }
  if (write.kind === 'add-opponent' && body.id && body.displayName)
    return newOpponent(body.id, body.displayName.trim(), write.createdAt)
  if (isRoundWrite(write) && !body.bye && body.newOpponentId && body.newOpponentName)
    return newOpponent(body.newOpponentId, body.newOpponentName.trim(), write.createdAt)
  return undefined
}

const byName = (a: OpponentView, b: OpponentView) =>
  a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase()) || a.id.localeCompare(b.id)

/** The Opponents list with the Opponents that pending writes add. */
export function applyToOpponentList(
  opponents: OpponentView[],
  writes: readonly OutboxWrite[],
): OpponentView[] {
  const added = writes
    .filter(isPending)
    .map(addedOpponent)
    .filter((o): o is OpponentView => !!o && !opponents.some((x) => x.id === o.id))
  return added.length ? [...opponents, ...added].sort(byName) : opponents
}

function sortEntries(entries: NoteEntryView[]) {
  return entries.toSorted(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  )
}

function applyToOpponent(detail: OpponentDetailView, write: OutboxWrite): OpponentDetailView {
  const id = write.subject.noteEntryId
  const others = detail.noteEntries.filter((e) => e.id !== id)
  const existing = detail.noteEntries.find((e) => e.id === id)
  const fields = (write.request.body ?? {}) as Partial<NoteEntryView>
  if (write.kind === 'delete-note-entry')
    return existing ? { ...detail, noteEntries: others } : detail
  if (write.kind === 'edit-note-entry' && !existing) return detail
  const entry: NoteEntryView = {
    id: id!,
    date: fields.date ?? existing?.date ?? '',
    text: fields.text ?? existing?.text ?? '',
    createdAt: existing?.createdAt ?? write.createdAt,
    updatedAt: write.createdAt,
  }
  return { ...detail, noteEntries: sortEntries([...others, entry]) }
}

const isNoteEntryWrite = (write: OutboxWrite) => write.kind.endsWith('note-entry')

/**
 * An Opponent's page with the pending changes to their Note entries. With no page cached yet,
 * an Opponent added on this device gets one, so it can open before the server has them.
 */
export function applyToOpponentDetail(
  detail: OpponentDetailView | undefined,
  opponentId: string,
  writes: readonly OutboxWrite[],
): OpponentDetailView | undefined {
  const pending = writes.filter(isPending)
  let start = detail
  if (!start) {
    const added = pending.map(addedOpponent).find((o) => o?.id === opponentId)
    if (!added) return undefined
    start = { ...added, rounds: [], noteEntries: [], opponentTeams: [], opponentAgeDivisions: [] }
  }
  return pending
    .filter((w) => isNoteEntryWrite(w) && w.subject.opponentId === opponentId)
    .reduce(applyToOpponent, start)
}

function revertInOpponent(detail: OpponentDetailView, write: OutboxWrite): OpponentDetailView {
  if (!isNoteEntryWrite(write) || write.subject.opponentId !== detail.id) return detail
  const id = write.subject.noteEntryId
  const before = write.subject.before as NoteEntryView | undefined
  const others = detail.noteEntries.filter((e) => e.id !== id)
  return { ...detail, noteEntries: sortEntries(before ? [...others, before] : others) }
}

/** The cached queries the outbox changes, by their key. */
type Target =
  | { kind: 'tournament'; id: string }
  | { kind: 'tournaments' }
  | { kind: 'opponents' }
  | { kind: 'opponent'; id: string }

function targetOf(key: readonly unknown[]): Target | undefined {
  if (key[0] === 'tournament' && typeof key[1] === 'string' && key.length === 2)
    return { kind: 'tournament', id: key[1] }
  if (key[0] === 'tournaments' && key.length === 1) return { kind: 'tournaments' }
  if (key[0] === 'opponents' && key[1] === 'list' && key.length === 2) return { kind: 'opponents' }
  if (key[0] === 'opponents' && key[1] === 'detail' && typeof key[2] === 'string')
    return { kind: 'opponent', id: key[2] }
  return undefined
}

/** Whether the outbox changes what the query with this key shows. */
export const isOutboxTarget = (key: readonly unknown[]) => targetOf(key) !== undefined

/** The list as it was when no item changed, so the page knows nothing did. */
const sameIfUnchanged = <T>(before: T[], after: T[]) =>
  after.every((item, index) => item === before[index]) ? before : after

/**
 * A cached query's data with every pending write applied. The same data comes back when no
 * pending write changes it.
 */
export function applyPending(
  key: readonly unknown[],
  data: unknown,
  writes: readonly OutboxWrite[],
): unknown {
  const target = targetOf(key)
  if (!target) return data
  switch (target.kind) {
    case 'tournament':
      return data ? applyToTournamentView(data as TournamentView, writes) : data
    case 'tournaments':
      return Array.isArray(data)
        ? sameIfUnchanged(
            data as TournamentView[],
            (data as TournamentView[]).map((t) => applyToTournamentView(t, writes)),
          )
        : data
    case 'opponents':
      return Array.isArray(data) ? applyToOpponentList(data as OpponentView[], writes) : data
    case 'opponent':
      return applyToOpponentDetail(data as OpponentDetailView | undefined, target.id, writes)
  }
}

/** A cached query's data with a write that won't be sent taken back out, as far as it can be. */
export function revertWrite(key: readonly unknown[], data: unknown, write: OutboxWrite): unknown {
  const target = targetOf(key)
  if (!target || !data) return data
  switch (target.kind) {
    case 'tournament':
      return revertInTournament(data as TournamentView, write)
    case 'tournaments':
      return Array.isArray(data)
        ? sameIfUnchanged(
            data as TournamentView[],
            (data as TournamentView[]).map((t) => revertInTournament(t, write)),
          )
        : data
    case 'opponents': {
      const added = addedOpponent(write)
      return added && Array.isArray(data)
        ? (data as OpponentView[]).filter((o) => o.id !== added.id)
        : data
    }
    case 'opponent':
      return revertInOpponent(data as OpponentDetailView, write)
  }
}
