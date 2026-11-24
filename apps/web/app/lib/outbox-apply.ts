import {
  type AppliedFilters,
  compareRounds,
  type DashboardView,
  isUpcoming,
  type NewTournament,
  type NoteEntryView,
  type OpponentDetailView,
  type OpponentView,
  opponentChangesSchema,
  type PokemonBuild,
  recordOf,
  roundInputSchema,
  roundResult,
  type RoundView,
  regulationOn,
  settleRound,
  summarize,
  type SummaryTournament,
  type TeamSnapshotView,
  today,
  type TournamentView,
  tournamentWarnings,
} from '@myvgc/core/schema'
import type { OutboxWrite } from './outbox-rules'

// What pending writes change on the pages before the server has them (ADR 17): the Tournament,
// its details, Team snapshot, Rounds and Record, the Tournaments list, the dashboard, the
// Opponents list, the Round form's Opponent suggestions, an Opponent's page and Note entries, and
// the User's Player details and List styles.
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

export const isRoundWrite = (write: OutboxWrite) =>
  write.kind === 'log-round' || write.kind === 'edit-round' || write.kind === 'delete-round'

/** A write on a Tournament itself: creating, changing or deleting it, or its Team. */
export const isTournamentWrite = (write: OutboxWrite) =>
  write.kind === 'add-tournament' ||
  write.kind === 'edit-tournament' ||
  write.kind === 'delete-tournament' ||
  write.kind === 'link-tournament-team' ||
  write.kind === 'unlink-tournament-team'

/** Blank text is "not given", as the server reads it. */
const text = (value: unknown) =>
  typeof value === 'string' ? value.trim() || null : (value as string | null | undefined)

type SentFields = Partial<NewTournament>

/** A Tournament with its Team snapshot, and what follows from it and the dates. */
const withTeam = (tournament: TournamentView, team: TeamSnapshotView | null): TournamentView => ({
  ...tournament,
  team,
  upcoming: isUpcoming(tournament.startDate, today()),
  warnings: tournamentWarnings({ regulation: tournament.regulation, team }),
})

/**
 * A Tournament with fields as a write sends them, as the server would save them: blank text is
 * "not given", and Upcoming and the warnings follow from the result.
 */
function withFields(tournament: TournamentView, fields: SentFields): TournamentView {
  const after: TournamentView = { ...tournament }
  const set = <K extends keyof TournamentView>(key: K, value: unknown) => {
    if (value !== undefined) after[key] = value as TournamentView[K]
  }
  set('name', typeof fields.name === 'string' ? fields.name.trim() : undefined)
  set('startDate', fields.startDate)
  set('endDate', fields.endDate)
  set('eventTier', fields.eventTier)
  set('online', fields.online)
  set('regulation', fields.regulation)
  set('defaultBestOf', fields.defaultBestOf)
  set('location', text(fields.location))
  set('organizer', text(fields.organizer))
  set('entryFee', fields.entryFee)
  set('championshipPoints', fields.championshipPoints)
  set('playerCount', fields.playerCount)
  set('link', text(fields.link))
  set('placement', fields.placement)
  set('dropped', fields.dropped)
  set('notes', fields.notes)
  return withTeam(after, after.team)
}

const isDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

/** The Tournament a write creates, as the pages show it before the server has it. */
export function addedTournament(write: OutboxWrite): TournamentView | undefined {
  const id = write.subject.tournamentId
  if (write.kind !== 'add-tournament' || !id) return undefined
  const body = (write.request.body ?? {}) as SentFields
  const startDate = isDate(body.startDate) ? body.startDate : write.createdAt.slice(0, 10)
  const blank: TournamentView = {
    id,
    name: '',
    startDate,
    endDate: null,
    eventTier: 'other',
    online: false,
    regulation: regulationOn(startDate),
    defaultBestOf: 1,
    location: null,
    organizer: null,
    entryFee: null,
    championshipPoints: null,
    playerCount: null,
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
    record: recordOf([]),
    warnings: [],
    createdAt: write.createdAt,
    updatedAt: write.createdAt,
  }
  return withFields(blank, body)
}

/** A Tournament with one write on it or its Rounds applied. */
function applyOne(tournament: TournamentView, write: OutboxWrite): TournamentView {
  if (isRoundWrite(write)) return applyToTournament(tournament, write)
  switch (write.kind) {
    // A new Tournament fixed after the server refused it shows as fixed.
    case 'add-tournament':
    case 'edit-tournament':
      return withFields(tournament, (write.request.body ?? {}) as SentFields)
    case 'link-tournament-team':
      return write.subject.after
        ? withTeam(tournament, write.subject.after as TeamSnapshotView)
        : tournament
    case 'unlink-tournament-team':
      return withTeam(tournament, null)
    default:
      return tournament
  }
}

/** Whether a write changes this Tournament as its page shows it. */
const changesTournament = (write: OutboxWrite, id: string) =>
  write.subject.tournamentId === id && (isRoundWrite(write) || isTournamentWrite(write))

/**
 * A Tournament as it would be with one write applied, whatever its state: a rejected Round
 * shown in the list, or a rejected change opened to be fixed.
 */
export function withWrite(tournament: TournamentView, write: OutboxWrite): TournamentView {
  if (!Array.isArray(tournament.rounds) || write.subject.tournamentId !== tournament.id)
    return tournament
  return applyOne(tournament, write)
}

/** A Tournament with the pending writes on it and its Rounds applied. */
export function applyToTournamentView(
  tournament: TournamentView,
  writes: readonly OutboxWrite[],
): TournamentView {
  if (!Array.isArray(tournament.rounds)) return tournament
  return writes
    .filter((w) => isPending(w) && changesTournament(w, tournament.id))
    .reduce(applyOne, tournament)
}

/**
 * A Tournament's page with the pending writes on it. With no page cached yet, a Tournament
 * created on this device gets one, also while its create is refused, so it can still be opened,
 * have Rounds logged in it, and be fixed.
 */
export function applyToTournamentDetail(
  tournament: TournamentView | undefined,
  id: string,
  writes: readonly OutboxWrite[],
): TournamentView | undefined {
  const start =
    tournament ?? writes.map(addedTournament).find((t): t is TournamentView => t?.id === id)
  return start ? applyToTournamentView(start, writes) : undefined
}

/** Newest first, as the server lists them. */
const byStart = (a: TournamentView, b: TournamentView) =>
  b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt)

/** The Tournaments list with the pending writes: new ones in, deleted ones out, the rest changed. */
export function applyToTournamentList(
  tournaments: TournamentView[],
  writes: readonly OutboxWrite[],
): TournamentView[] {
  const pending = writes.filter(isPending)
  const added = pending
    .map(addedTournament)
    .filter((t): t is TournamentView => !!t && !tournaments.some((x) => x.id === t.id))
  const deleted = new Set(
    pending.filter((w) => w.kind === 'delete-tournament').map((w) => w.subject.tournamentId),
  )
  const after = [...tournaments, ...added]
    .filter((t) => !deleted.has(t.id))
    .map((t) => applyToTournamentView(t, pending))
  if (added.length || deleted.size) return after.sort(byStart)
  return sameIfUnchanged(tournaments, after)
}

/** A Tournament with a write that won't be sent taken back out, as far as it can be. */
function revertInTournament(tournament: TournamentView, write: OutboxWrite): TournamentView {
  if (write.subject.tournamentId !== tournament.id || !Array.isArray(tournament.rounds))
    return tournament
  if (write.kind === 'edit-tournament') {
    const before = write.subject.before as TournamentView | undefined
    if (!before) return tournament
    // Only the details go back: the Rounds, Team and Teamsheet are kept as they are now.
    const details = { ...before } as Partial<TournamentView>
    for (const key of [
      'rounds',
      'opponentTeams',
      'opponentAgeDivisions',
      'record',
      'team',
      'teamsheet',
    ] as const)
      delete details[key]
    return withTeam({ ...tournament, ...details }, tournament.team)
  }
  if (write.kind === 'link-tournament-team' || write.kind === 'unlink-tournament-team')
    return withTeam(tournament, (write.subject.before as TeamSnapshotView | null) ?? null)
  if (!isRoundWrite(write)) return tournament
  const id = write.subject.roundId
  const before = write.subject.before as RoundView | undefined
  const others = tournament.rounds.filter((r) => r.id !== id)
  return standing(tournament, before ? [...others, before] : others)
}

/** The Tournaments list with a write that won't be sent taken back out. */
function revertInTournamentList(list: TournamentView[], write: OutboxWrite): TournamentView[] {
  const id = write.subject.tournamentId
  if (write.kind === 'add-tournament')
    return list.some((t) => t.id === id) ? list.filter((t) => t.id !== id) : list
  if (write.kind === 'delete-tournament') {
    const before = write.subject.before as TournamentView | undefined
    return before && !list.some((t) => t.id === id) ? [...list, before].sort(byStart) : list
  }
  return sameIfUnchanged(
    list,
    list.map((t) => revertInTournament(t, write)),
  )
}

/** A Tournament as the dashboard counts it. */
const toSummary = (t: TournamentView): SummaryTournament => ({
  id: t.id,
  name: t.name,
  startDate: t.startDate,
  createdAt: t.createdAt,
  playerCount: t.playerCount,
  placement: t.placement,
  championshipPoints: t.championshipPoints,
  entryFee: t.entryFee,
  team: t.team ? { teamId: t.team.teamId, name: t.team.name } : null,
  rounds: t.rounds,
})

/** Whether the dashboard's filters keep a Tournament, as the server applies them. */
const filteredIn = (t: TournamentView, filters: AppliedFilters) =>
  (filters.regulation === 'all' || t.regulation === filters.regulation) &&
  (!filters.from || t.startDate >= filters.from) &&
  (!filters.to || t.startDate <= filters.to) &&
  (!filters.eventTier.length || filters.eventTier.includes(t.eventTier)) &&
  (!filters.setting || t.online === (filters.setting === 'online'))

/**
 * The dashboard as it will be once the pending writes on Tournaments and Rounds are sent, worked
 * out from the cached Tournaments list. Without that list, or with nothing pending on them, it
 * stays as the server sent it.
 */
export function applyToDashboard(
  view: DashboardView,
  tournaments: TournamentView[] | undefined,
  writes: readonly OutboxWrite[],
): DashboardView {
  const pending = writes.filter((w) => isPending(w) && (isRoundWrite(w) || isTournamentWrite(w)))
  if (!pending.length || !Array.isArray(tournaments) || !view.filters) return view
  const counted = applyToTournamentList(tournaments, pending).filter((t) =>
    filteredIn(t, view.filters),
  )
  return { ...view, summary: summarize(counted.map(toSummary)) }
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
export function addedOpponent(write: OutboxWrite): OpponentView | undefined {
  const body = (write.request.body ?? {}) as {
    id?: string
    displayName?: string
    newOpponentId?: string
    newOpponentName?: string | null
    bye?: boolean
  }
  // A new Opponent fixed after the server refused them may have Aliases and notes too.
  if (write.kind === 'add-opponent' && body.id && body.displayName)
    return editedOpponent(newOpponent(body.id, body.displayName.trim(), write.createdAt), write)
  if (isRoundWrite(write) && !body.bye && body.newOpponentId && body.newOpponentName)
    return newOpponent(body.newOpponentId, body.newOpponentName.trim(), write.createdAt)
  return undefined
}

const byName = (a: OpponentView, b: OpponentView) =>
  a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase()) || a.id.localeCompare(b.id)

/** The fields an Opponent edit sends, as the server would save them, or nothing it can't read. */
function editedFields(write: OutboxWrite): Partial<OpponentView> | undefined {
  if (write.kind !== 'edit-opponent' && write.kind !== 'add-opponent') return undefined
  const parsed = opponentChangesSchema.safeParse(write.request.body)
  if (!parsed.success) return undefined
  const { displayName, aliases, notes } = parsed.data
  return {
    ...(displayName !== undefined ? { displayName } : {}),
    ...(aliases !== undefined ? { aliases } : {}),
    ...(notes !== undefined ? { notes } : {}),
  }
}

/** An Opponent with a write that changes them applied: an edit, or a fixed create. */
function editedOpponent<T extends OpponentView>(opponent: T, write: OutboxWrite): T {
  if (write.subject.opponentId !== opponent.id) return opponent
  const fields = editedFields(write)
  return fields ? { ...opponent, ...fields } : opponent
}

const isOpponentEdit = (write: OutboxWrite) => write.kind === 'edit-opponent'

/** The IDs of the Opponents that pending writes delete. */
const deletedOpponents = (writes: readonly OutboxWrite[]) =>
  new Set(
    writes
      .filter((w) => isPending(w) && w.kind === 'delete-opponent')
      .map((w) => w.subject.opponentId),
  )

/**
 * The Opponents list with the pending writes: the Opponents they add in, the ones they delete
 * out, and the rest changed.
 */
export function applyToOpponentList(
  opponents: OpponentView[],
  writes: readonly OutboxWrite[],
): OpponentView[] {
  const pending = writes.filter(isPending)
  const added = pending
    .map(addedOpponent)
    .filter((o): o is OpponentView => !!o && !opponents.some((x) => x.id === o.id))
  const deleted = deletedOpponents(pending)
  const edits = pending.filter(isOpponentEdit)
  const after = [...opponents, ...added]
    .filter((o) => !deleted.has(o.id))
    .map((o) => edits.reduce(editedOpponent, o))
  if (after.length === opponents.length && sameIfUnchanged(opponents, after) === opponents)
    return opponents
  return after.toSorted(byName)
}

/**
 * The Round form's Opponent suggestions with the pending writes: an Opponent changed shows as
 * changed, and one deleted isn't suggested. A new Opponent only shows once searched for again,
 * as the suggestions are a search.
 */
export function applyToSuggestions(
  opponents: OpponentView[],
  writes: readonly OutboxWrite[],
): OpponentView[] {
  const pending = writes.filter(isPending)
  const deleted = deletedOpponents(pending)
  const edits = pending.filter(isOpponentEdit)
  if (!deleted.size && !edits.length) return opponents
  const after = opponents
    .filter((o) => !deleted.has(o.id))
    .map((o) => edits.reduce(editedOpponent, o))
  return after.length === opponents.length ? sameIfUnchanged(opponents, after) : after
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
 * An Opponent's page with the pending changes to them and their Note entries. With no page
 * cached yet, an Opponent added on this device gets one, also while their create is refused, so
 * it can open before the server has them, and be fixed.
 */
export function applyToOpponentDetail(
  detail: OpponentDetailView | undefined,
  opponentId: string,
  writes: readonly OutboxWrite[],
): OpponentDetailView | undefined {
  const pending = writes.filter(isPending)
  let start = detail
  if (!start) {
    const added = writes
      .filter((w) => isPending(w) || w.kind === 'add-opponent')
      .map(addedOpponent)
      .find((o) => o?.id === opponentId)
    if (!added) return undefined
    start = { ...added, rounds: [], noteEntries: [], opponentTeams: [], opponentAgeDivisions: [] }
  }
  return pending
    .filter((w) => w.subject.opponentId === opponentId)
    .reduce(
      (page, write) =>
        isNoteEntryWrite(write)
          ? applyToOpponent(page, write)
          : isOpponentEdit(write)
            ? editedOpponent(page, write)
            : page,
      start,
    )
}

/** An Opponent with a change that won't be sent put back as it was. */
function revertOpponentFields<T extends OpponentView>(opponent: T, write: OutboxWrite): T {
  const before = write.subject.before as OpponentView | undefined
  if (!isOpponentEdit(write) || write.subject.opponentId !== opponent.id || !before) return opponent
  const { displayName, aliases, notes } = before
  return { ...opponent, displayName, aliases, notes }
}

/** The Opponents list with a write that won't be sent taken back out. */
function revertInOpponentList(list: OpponentView[], write: OutboxWrite): OpponentView[] {
  const added = addedOpponent(write)
  if (added)
    return list.some((o) => o.id === added.id) ? list.filter((o) => o.id !== added.id) : list
  if (write.kind === 'delete-opponent') {
    const before = write.subject.before as OpponentView | undefined
    return before && !list.some((o) => o.id === before.id)
      ? [...list, before].toSorted(byName)
      : list
  }
  return sameIfUnchanged(
    list,
    list.map((o) => revertOpponentFields(o, write)),
  )
}

/** An account setting, replaced whole, as the last pending save of it makes it. */
function applySetting(data: unknown, kind: OutboxWrite['kind'], writes: readonly OutboxWrite[]) {
  const last = writes.findLast((w) => isPending(w) && w.kind === kind)
  return last?.request.body && typeof last.request.body === 'object'
    ? { ...(data as object), ...last.request.body }
    : data
}

function revertInOpponent(detail: OpponentDetailView, write: OutboxWrite): OpponentDetailView {
  if (isOpponentEdit(write)) return revertOpponentFields(detail, write)
  if (!isNoteEntryWrite(write) || write.subject.opponentId !== detail.id) return detail
  const id = write.subject.noteEntryId
  const before = write.subject.before as NoteEntryView | undefined
  const others = detail.noteEntries.filter((e) => e.id !== id)
  return { ...detail, noteEntries: sortEntries(before ? [...others, before] : others) }
}

/** The cached queries the outbox changes, by their key. */
type Target =
  | { kind: 'tournament'; id: string }
  | { kind: 'dashboard' }
  | { kind: 'tournaments' }
  | { kind: 'opponents' }
  | { kind: 'suggestions' }
  | { kind: 'opponent'; id: string }
  | { kind: 'setting'; write: 'save-player-details' | 'save-list-styles' }

function targetOf(key: readonly unknown[]): Target | undefined {
  if (key[0] === 'tournament' && typeof key[1] === 'string' && key.length === 2)
    return { kind: 'tournament', id: key[1] }
  if (key[0] === 'tournaments' && key.length === 1) return { kind: 'tournaments' }
  if (key[0] === 'dashboard') return { kind: 'dashboard' }
  if (key[0] === 'opponents' && key[1] === 'list' && key.length === 2) return { kind: 'opponents' }
  if (key[0] === 'opponents' && key[1] === 'suggestions') return { kind: 'suggestions' }
  if (key[0] === 'opponents' && key[1] === 'detail' && typeof key[2] === 'string')
    return { kind: 'opponent', id: key[2] }
  if (key[0] === 'account' && key[1] === 'player-details' && key.length === 2)
    return { kind: 'setting', write: 'save-player-details' }
  if (key[0] === 'account' && key[1] === 'list-styles' && key.length === 2)
    return { kind: 'setting', write: 'save-list-styles' }
  return undefined
}

/** Whether the outbox changes what the query with this key shows. */
export const isOutboxTarget = (key: readonly unknown[]) => targetOf(key) !== undefined

/** The list as it was when no item changed, so the page knows nothing did. */
const sameIfUnchanged = <T>(before: T[], after: T[]) =>
  after.every((item, index) => item === before[index]) ? before : after

/** Other cached data a query's data is worked out from: the dashboard needs the Tournaments list. */
export interface ApplyContext {
  tournaments?: unknown
}

/**
 * A cached query's data with every pending write applied. The same data comes back when no
 * pending write changes it.
 */
export function applyPending(
  key: readonly unknown[],
  data: unknown,
  writes: readonly OutboxWrite[],
  context: ApplyContext = {},
): unknown {
  const target = targetOf(key)
  if (!target) return data
  switch (target.kind) {
    case 'tournament':
      return applyToTournamentDetail(data as TournamentView | undefined, target.id, writes)
    case 'tournaments':
      return Array.isArray(data) ? applyToTournamentList(data as TournamentView[], writes) : data
    case 'dashboard':
      return data
        ? applyToDashboard(
            data as DashboardView,
            context.tournaments as TournamentView[] | undefined,
            writes,
          )
        : data
    case 'opponents':
      return Array.isArray(data) ? applyToOpponentList(data as OpponentView[], writes) : data
    case 'suggestions':
      return Array.isArray(data) ? applyToSuggestions(data as OpponentView[], writes) : data
    case 'opponent':
      return applyToOpponentDetail(data as OpponentDetailView | undefined, target.id, writes)
    case 'setting':
      return data === undefined ? data : applySetting(data, target.write, writes)
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
      return Array.isArray(data) ? revertInTournamentList(data as TournamentView[], write) : data
    case 'dashboard':
      // Worked out again from the Tournaments list, then asked of the server again.
      return data
    case 'opponents':
      return Array.isArray(data) ? revertInOpponentList(data as OpponentView[], write) : data
    case 'suggestions':
      // Then asked of the server again.
      return Array.isArray(data)
        ? sameIfUnchanged(
            data as OpponentView[],
            (data as OpponentView[]).map((o) => revertOpponentFields(o, write)),
          )
        : data
    case 'opponent':
      return revertInOpponent(data as OpponentDetailView, write)
    case 'setting':
      return write.kind === target.write && write.subject.before ? write.subject.before : data
  }
}
